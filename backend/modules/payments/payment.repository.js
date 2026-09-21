/**
 * LayerLedger Payment Repository
 * Adheres to Principles:
 * #1 (Idempotency Key Unique), #2 (Unique Payment Reference), #8 (Webhook Idempotency),
 * #13 (Original Amount Snapshot), #15 (Payment Attempts), #16 (Never Delete Financial Records),
 * #19 & #20 (Database-Level Protection & Concurrency), #21 (Atomic Transactions),
 * #22 (Locks & Atomic Updates), #28 (Refund Architecture), #33 (Audit Trail)
 */

const prisma = require('../../prisma');
const { PAYMENT_STATES, REFUND_STATES, isValidTransition, ERROR_CODES } = require('./payment.constants');

class PaymentRepository {
    constructor(client = prisma) {
        this.prisma = client;
    }

    /**
     * Find existing payment by idempotency key (#1)
     */
    async findByIdempotencyKey(idempotencyKey) {
        if (!idempotencyKey) return null;
        return this.prisma.payment.findUnique({
            where: { idempotencyKey },
            include: { attempts: true, refunds: true, auditEvents: true }
        });
    }

    /**
     * Find payment by internal payment reference (#2)
     */
    async findByReference(paymentReference) {
        if (!paymentReference) return null;
        return this.prisma.payment.findUnique({
            where: { paymentReference },
            include: { attempts: true, refunds: true, auditEvents: true }
        });
    }

    /**
     * Find payment by provider reference
     */
    async findByProviderReference(providerReference) {
        if (!providerReference) return null;
        return this.prisma.payment.findFirst({
            where: { providerReference },
            include: { attempts: true, refunds: true }
        });
    }

    /**
     * Create new payment with initial attempt and audit event inside transaction (#21)
     */
    async createPayment({
        tenantId,
        userId,
        resourceType,
        resourceId,
        idempotencyKey,
        paymentReference,
        amount,
        currency = 'NGN',
        fees = 0,
        totalAmount,
        customerEmail,
        customerName,
        metadata = {},
        provider = 'paystack'
    }) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    tenantId,
                    userId,
                    resourceType,
                    resourceId,
                    idempotencyKey,
                    paymentReference,
                    amount,
                    currency,
                    fees,
                    totalAmount: totalAmount || amount + fees,
                    status: PAYMENT_STATES.PENDING,
                    customerEmail,
                    customerName,
                    provider,
                    metadata
                }
            });

            // Record initial audit event (#33)
            await tx.paymentAuditEvent.create({
                data: {
                    paymentId: payment.id,
                    event: 'PAYMENT_CREATED',
                    actor: userId || 'customer',
                    source: 'api',
                    metadata: { amount, currency, resourceType, resourceId }
                }
            });

            return payment;
        });
    }

    /**
     * Add a payment attempt record (#15)
     */
    async recordPaymentAttempt({
        paymentId,
        status = PAYMENT_STATES.INITIALIZED,
        provider = 'paystack',
        providerReference,
        authorizationUrl,
        accessCode,
        requestPayload,
        responsePayload,
        errorMessage,
        ipAddress,
        userAgent
    }) {
        const existingCount = await this.prisma.paymentAttempt.count({
            where: { paymentId }
        });

        return this.prisma.paymentAttempt.create({
            data: {
                paymentId,
                attemptNumber: existingCount + 1,
                status,
                provider,
                providerReference,
                authorizationUrl,
                accessCode,
                requestPayload: requestPayload || {},
                responsePayload: responsePayload || {},
                errorMessage,
                ipAddress,
                userAgent
            }
        });
    }

    /**
     * Update payment state atomically with transition verification (#5, #19, #21)
     */
    async transitionPaymentState({
        paymentReference,
        nextState,
        providerReference,
        providerStatus,
        metadataUpdate = {},
        actor = 'system',
        source = 'payment_service',
        force = false
    }) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { paymentReference }
            });

            if (!payment) {
                const err = new Error(`Payment with reference ${paymentReference} not found`);
                err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
                throw err;
            }

            // Verify state transition validity (#5)
            if (!force && !isValidTransition(payment.status, nextState)) {
                const err = new Error(
                    `Illegal state transition from ${payment.status} to ${nextState} for payment ${paymentReference}`
                );
                err.code = ERROR_CODES.INVALID_STATE_TRANSITION;
                throw err;
            }

            const updatedData = {
                status: nextState,
                updatedAt: new Date()
            };

            if (providerReference) updatedData.providerReference = providerReference;
            if (providerStatus) updatedData.providerStatus = providerStatus;
            if (Object.keys(metadataUpdate).length > 0) {
                updatedData.metadata = {
                    ...(payment.metadata || {}),
                    ...metadataUpdate
                };
            }

            const updatedPayment = await tx.payment.update({
                where: { paymentReference },
                data: updatedData
            });

            // Record audit trail event (#33)
            await tx.paymentAuditEvent.create({
                data: {
                    paymentId: payment.id,
                    event: `STATUS_CHANGED_TO_${nextState}`,
                    actor,
                    source,
                    metadata: {
                        previousStatus: payment.status,
                        newStatus: nextState,
                        providerReference,
                        providerStatus
                    }
                }
            });

            return updatedPayment;
        });
    }

    /**
     * Record incoming webhook event with uniqueness guarantee (#8)
     */
    async recordWebhookEvent({
        provider = 'paystack',
        eventId,
        eventType,
        payload,
        signature
    }) {
        return this.prisma.paymentWebhookEvent.create({
            data: {
                provider,
                eventId,
                eventType,
                payload: payload || {},
                signature,
                status: 'PENDING',
                receivedAt: new Date()
            }
        });
    }

    /**
     * Find webhook event by provider + eventId (#8)
     */
    async findWebhookEvent(provider, eventId) {
        return this.prisma.paymentWebhookEvent.findUnique({
            where: {
                provider_eventId: {
                    provider,
                    eventId
                }
            }
        });
    }

    /**
     * Mark webhook event processed or failed
     */
    async updateWebhookEventStatus(provider, eventId, status, errorMessage = null) {
        return this.prisma.paymentWebhookEvent.update({
            where: {
                provider_eventId: {
                    provider,
                    eventId
                }
            },
            data: {
                status,
                processedAt: new Date(),
                errorMessage
            }
        });
    }

    /**
     * Create a refund record with idempotency and amount limits (#28, #29, #30)
     */
    async createRefund({
        paymentReference,
        refundReference,
        idempotencyKey,
        amount,
        reason,
        provider = 'paystack',
        requestedBy
    }) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { paymentReference }
            });

            if (!payment) {
                const err = new Error(`Payment with reference ${paymentReference} not found`);
                err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
                throw err;
            }

            // Principle #29: Total refunded amount can never exceed the original payment amount
            const currentRefunded = payment.refundedAmount || 0;
            const newTotalRefunded = currentRefunded + amount;

            if (newTotalRefunded > payment.amount) {
                const err = new Error(
                    `Refund of ${amount} exceeds remaining refundable balance (${payment.amount - currentRefunded})`
                );
                err.code = ERROR_CODES.REFUND_LIMIT_EXCEEDED;
                throw err;
            }

            const refund = await tx.paymentRefund.create({
                data: {
                    paymentId: payment.id,
                    refundReference,
                    idempotencyKey,
                    amount,
                    currency: payment.currency,
                    status: REFUND_STATES.PENDING,
                    reason,
                    provider,
                    requestedBy
                }
            });

            // Update payment state to REFUND_PENDING
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: PAYMENT_STATES.REFUND_PENDING }
            });

            // Audit
            await tx.paymentAuditEvent.create({
                data: {
                    paymentId: payment.id,
                    event: 'REFUND_REQUESTED',
                    actor: requestedBy || 'admin',
                    source: 'refund_service',
                    metadata: { refundReference, amount, reason }
                }
            });

            return refund;
        });
    }

    /**
     * Mark refund successful and update payment refunded totals (#28, #29)
     */
    async completeRefund({
        refundReference,
        providerReference,
        providerResponse = {}
    }) {
        return this.prisma.$transaction(async (tx) => {
            const refund = await tx.paymentRefund.findUnique({
                where: { refundReference },
                include: { payment: true }
            });

            if (!refund) {
                const err = new Error(`Refund ${refundReference} not found`);
                err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
                throw err;
            }

            const payment = refund.payment;
            const newRefundedAmount = (payment.refundedAmount || 0) + refund.amount;
            const isFullRefund = newRefundedAmount >= payment.amount;
            const nextPaymentState = isFullRefund ? PAYMENT_STATES.REFUNDED : PAYMENT_STATES.PARTIALLY_REFUNDED;

            const updatedRefund = await tx.paymentRefund.update({
                where: { refundReference },
                data: {
                    status: REFUND_STATES.SUCCESS,
                    providerReference,
                    providerResponse,
                    processedAt: new Date()
                }
            });

            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: nextPaymentState,
                    refundedAmount: newRefundedAmount
                }
            });

            await tx.paymentAuditEvent.create({
                data: {
                    paymentId: payment.id,
                    event: isFullRefund ? 'FULL_REFUND_COMPLETED' : 'PARTIAL_REFUND_COMPLETED',
                    actor: 'system',
                    source: 'refund_service',
                    metadata: {
                        refundReference,
                        amount: refund.amount,
                        newRefundedAmount,
                        isFullRefund
                    }
                }
            });

            return updatedRefund;
        });
    }

    /**
     * Find refund by idempotency key (#30)
     */
    async findRefundByIdempotencyKey(idempotencyKey) {
        if (!idempotencyKey) return null;
        return this.prisma.paymentRefund.findUnique({
            where: { idempotencyKey },
            include: { payment: true }
        });
    }

    /**
     * Find refund by reference (#28)
     */
    async findRefundByReference(refundReference) {
        if (!refundReference) return null;
        return this.prisma.paymentRefund.findUnique({
            where: { refundReference },
            include: { payment: true }
        });
    }

    /**
     * Find unresolved payments for reconciliation (#31, #32)
     */
    async findUnresolvedPayments(maxAgeMinutes = 30) {
        const thresholdDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
        return this.prisma.payment.findMany({
            where: {
                status: {
                    in: [
                        PAYMENT_STATES.PENDING,
                        PAYMENT_STATES.INITIALIZED,
                        PAYMENT_STATES.PROCESSING,
                        PAYMENT_STATES.REFUND_PENDING
                    ]
                },
                createdAt: { lte: thresholdDate }
            },
            take: 50,
            orderBy: { createdAt: 'asc' }
        });
    }

    /**
     * Create async background job (#24, #25)
     */
    async createJob(type, payload, runAt = new Date()) {
        return this.prisma.paymentJob.create({
            data: {
                type,
                payload: payload || {},
                status: 'PENDING',
                runAt
            }
        });
    }

    /**
     * Fetch pending jobs for worker processing (#25, #26)
     */
    async getPendingJobs(limit = 10) {
        return this.prisma.paymentJob.findMany({
            where: {
                status: 'PENDING',
                runAt: { lte: new Date() }
            },
            take: limit,
            orderBy: { runAt: 'asc' }
        });
    }

    /**
     * Update job status (#26, #27 - Dead letter)
     */
    async updateJobStatus(jobId, status, error = null, retryAfterMs = null) {
        const data = {
            status,
            updatedAt: new Date()
        };

        if (status === 'COMPLETED') {
            data.processedAt = new Date();
        } else if (status === 'FAILED' && retryAfterMs) {
            data.status = 'PENDING';
            data.runAt = new Date(Date.now() + retryAfterMs);
            data.attempts = { increment: 1 };
            data.lastError = error ? String(error) : null;
        } else if (status === 'DEAD_LETTER') {
            data.status = 'DEAD_LETTER';
            data.lastError = error ? String(error) : null;
            data.processedAt = new Date();
        }

        return this.prisma.paymentJob.update({
            where: { id: jobId },
            data
        });
    }
}

module.exports = new PaymentRepository();
