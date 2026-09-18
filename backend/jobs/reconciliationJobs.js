/**
 * LayerLedger Payment Reconciliation Worker
 * Adheres to Principles:
 * #31 (Reconciliation), #32 (Check Unresolved Payments: PENDING, PROCESSING, REFUND_PENDING),
 * #45 (Observability & Monitoring)
 */

const paymentRepository = require('../modules/payments/payment.repository');
const paymentService = require('../modules/payments/payment.service');
const PaystackProvider = require('../modules/payments/providers/paystack.provider');
const { PAYMENT_STATES } = require('../modules/payments/payment.constants');

class ReconciliationWorker {
    constructor(provider = new PaystackProvider(), repository = paymentRepository, service = paymentService) {
        this.provider = provider;
        this.repository = repository;
        this.paymentService = service;
    }

    /**
     * Run reconciliation pass across stale unresolved transactions (#31, #32)
     * @param {number} staleThresholdMinutes transactions older than this are checked
     */
    async reconcileStalePayments(staleThresholdMinutes = 15) {
        const stalePayments = await this.repository.findUnresolvedPayments(staleThresholdMinutes);
        const report = {
            checkedCount: stalePayments.length,
            reconciledSuccess: 0,
            markedFailed: 0,
            markedAbandoned: 0,
            unresolved: 0,
            discrepancies: []
        };

        for (const payment of stalePayments) {
            const ref = payment.paymentReference;
            try {
                // Query gateway provider server-side
                const gatewayData = await this.provider.verifyTransaction(ref);

                if (gatewayData.status === PAYMENT_STATES.SUCCESS) {
                    report.discrepancies.push({
                        reference: ref,
                        internalState: payment.status,
                        gatewayState: gatewayData.status,
                        resolution: 'RESOLVED_TO_SUCCESS'
                    });

                    await this.paymentService.verifyPayment(ref, {
                        actor: 'reconciliation_worker',
                        source: 'scheduled_reconciliation'
                    });
                    report.reconciledSuccess++;
                } else if (gatewayData.status === PAYMENT_STATES.ABANDONED) {
                    await this.repository.transitionPaymentState({
                        paymentReference: ref,
                        nextState: PAYMENT_STATES.ABANDONED,
                        providerReference: gatewayData.providerReference,
                        providerStatus: gatewayData.providerStatus,
                        actor: 'reconciliation_worker',
                        source: 'scheduled_reconciliation'
                    });
                    report.markedAbandoned++;
                } else if (gatewayData.status === PAYMENT_STATES.FAILED) {
                    await this.repository.transitionPaymentState({
                        paymentReference: ref,
                        nextState: PAYMENT_STATES.FAILED,
                        providerReference: gatewayData.providerReference,
                        providerStatus: gatewayData.providerStatus,
                        actor: 'reconciliation_worker',
                        source: 'scheduled_reconciliation'
                    });
                    report.markedFailed++;
                } else {
                    report.unresolved++;
                }
            } catch (err) {
                // If gateway returns 404 or transaction not found at provider, mark ABANDONED after 2 hours
                const ageMs = Date.now() - new Date(payment.createdAt).getTime();
                if (ageMs > 2 * 60 * 60 * 1000) {
                    try {
                        await this.repository.transitionPaymentState({
                            paymentReference: ref,
                            nextState: PAYMENT_STATES.ABANDONED,
                            metadataUpdate: { reconciliationNote: 'Expired/Abandoned at gateway' },
                            actor: 'reconciliation_worker'
                        });
                        report.markedAbandoned++;
                    } catch {
                        // ignore state errors
                    }
                } else {
                    report.unresolved++;
                }
            }
        }

        if (report.checkedCount > 0) {
            console.log(`[Reconciliation Complete]: Checked ${report.checkedCount} records. Resolved: ${report.reconciledSuccess} success, ${report.markedAbandoned} abandoned, ${report.markedFailed} failed.`);
        }

        return report;
    }
}

module.exports = new ReconciliationWorker();
