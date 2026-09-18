/**
 * LayerLedger Refund Service
 * Adheres to Principles:
 * #28 (Refund Architecture), #29 (Support Partial Refunds),
 * #30 (Refund Idempotency), #34 (Immutable Financial History)
 */

const crypto = require('crypto');
const paymentRepository = require('../payment.repository');
const PaystackProvider = require('../providers/paystack.provider');
const {
    ERROR_CODES,
    toMinorUnits,
    toMajorUnits
} = require('../payment.constants');

class RefundService {
    constructor(provider = new PaystackProvider(), repository = paymentRepository) {
        this.provider = provider;
        this.repository = repository;
    }

    generateRefundReference(prefix = 'LL-REF') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `${prefix}-${timestamp}-${rand}`;
    }

    /**
     * Process refund with full idempotency and remaining amount guards
     */
    async processRefund({
        paymentReference,
        amount,
        amountInMinorUnits,
        reason,
        idempotencyKey,
        requestedBy
    }) {
        // Principle #30: Refund Idempotency
        if (idempotencyKey) {
            const existingRefund = await this.repository.findRefundByIdempotencyKey(idempotencyKey);
            if (existingRefund) {
                return {
                    idempotentReplay: true,
                    refund: existingRefund,
                    status: existingRefund.status,
                    refundReference: existingRefund.refundReference,
                    amount: toMajorUnits(existingRefund.amount, existingRefund.currency)
                };
            }
        }

        const payment = await this.repository.findByReference(paymentReference);
        if (!payment) {
            const err = new Error(`Payment with reference ${paymentReference} not found`);
            err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
            throw err;
        }

        const currentRefunded = payment.refundedAmount || 0;
        const remainingRefundable = payment.amount - currentRefunded;

        if (remainingRefundable <= 0) {
            const err = new Error(`Payment ${paymentReference} has already been fully refunded.`);
            err.code = ERROR_CODES.REFUND_LIMIT_EXCEEDED;
            throw err;
        }

        // Determine refund minor units
        let targetMinorUnits = remainingRefundable;
        if (amountInMinorUnits && Number(amountInMinorUnits) > 0) {
            targetMinorUnits = Number(amountInMinorUnits);
        } else if (amount && Number(amount) > 0) {
            targetMinorUnits = toMinorUnits(amount, payment.currency);
        }

        // Principle #29: Never allow total refunded to exceed original payment
        if (targetMinorUnits > remainingRefundable) {
            const maxMajor = toMajorUnits(remainingRefundable, payment.currency);
            const err = new Error(
                `Requested refund (${toMajorUnits(targetMinorUnits, payment.currency)} ${payment.currency}) exceeds remaining balance of ${maxMajor} ${payment.currency}`
            );
            err.code = ERROR_CODES.REFUND_LIMIT_EXCEEDED;
            throw err;
        }

        const refundReference = this.generateRefundReference();
        const effectiveIdempotencyKey = idempotencyKey || `REF-IDEM-${refundReference}`;

        // Create initial pending refund record in database (#28)
        await this.repository.createRefund({
            paymentReference,
            refundReference,
            idempotencyKey: effectiveIdempotencyKey,
            amount: targetMinorUnits,
            reason: reason || 'Customer requested refund',
            provider: payment.provider || 'paystack',
            requestedBy
        });

        // Call gateway provider
        let providerResult;
        try {
            providerResult = await this.provider.processRefund({
                transactionReference: payment.providerReference || paymentReference,
                amountInMinorUnits: targetMinorUnits,
                currency: payment.currency,
                reason
            });
        } catch (err) {
            console.error(`[Refund Gateway Error for ${refundReference}]:`, err.message);
            // Even if gateway failed, refund record remains in DB with audit history (#16, #34)
            throw err;
        }

        // Complete refund in DB and update payment status to PARTIALLY_REFUNDED or REFUNDED (#21, #28, #29)
        const completedRefund = await this.repository.completeRefund({
            refundReference,
            providerReference: providerResult.providerReference,
            providerResponse: providerResult.rawResponse
        });

        return {
            idempotentReplay: false,
            success: true,
            refund: completedRefund,
            refundReference,
            amount: toMajorUnits(targetMinorUnits, payment.currency),
            currency: payment.currency,
            status: completedRefund.status
        };
    }
}

module.exports = new RefundService();
