/**
 * LayerLedger Payment Service
 * Core orchestrator for the payment lifecycle.
 * Adheres to Principles:
 * #1 (Idempotency), #2 (Unique Payment Reference), #3 & #4 (Backend Authority for Amounts),
 * #5 (State Machine), #9, #10 & #11 (Verify Provider, Amount & Currency),
 * #13 (Original Amount Snapshot), #14 (Domain Separation), #17 & #18 (Failure/Retry Safety),
 * #19 & #22 (Race Condition & Concurrency Safety), #41 (Provider Abstraction)
 */

const crypto = require('crypto');
const paymentRepository = require('./payment.repository');
const PaystackProvider = require('./providers/paystack.provider');
const {
    PAYMENT_STATES,
    ERROR_CODES,
    toMinorUnits,
    toMajorUnits
} = require('./payment.constants');
const { PLAN_LIMITS, MULTI_MONTH_DISCOUNTS } = require('../../controller/planController');
const { CREDIT_PACKS } = require('../../controller/tokenController');
const prisma = require('../../prisma');

class PaymentService {
    constructor(provider = new PaystackProvider(), repository = paymentRepository) {
        this.provider = provider;
        this.repository = repository;
    }

    /**
     * Generate unique payment reference (#2)
     */
    generatePaymentReference(prefix = 'LL-PAY') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `${prefix}-${timestamp}-${randomPart}`;
    }

    /**
     * Authoritatively calculate amount from backend models (#3, #4, #13)
     */
    async calculateAuthoritativeAmount(resourceType, resourceId, options = {}) {
        if (resourceType === 'subscription_plan') {
            let planKey = (resourceId || options.plan || '').toLowerCase();
            if (planKey === 'studio') planKey = 'premium';
            const config = PLAN_LIMITS[planKey];
            if (!config || (planKey !== 'standard' && planKey !== 'premium')) {
                const err = new Error(`Invalid plan "${planKey}". Allowed plans are "standard" and "premium".`);
                err.code = ERROR_CODES.VALIDATION_ERROR;
                throw err;
            }

            const months = Number(options.months) || 1;
            if (![1, 3, 6, 12].includes(months)) {
                const err = new Error('Duration must be 1, 3, 6, or 12 months.');
                err.code = ERROR_CODES.VALIDATION_ERROR;
                throw err;
            }

            const discountRate = MULTI_MONTH_DISCOUNTS[months] || 0;
            const basePrice = config.monthlyPrice * months;
            const discountAmount = Math.round(basePrice * discountRate);
            const finalPriceMajor = basePrice - discountAmount;
            const amountInMinorUnits = toMinorUnits(finalPriceMajor, 'NGN');

            return {
                amountInMinorUnits,
                currency: 'NGN',
                metadataSnapshot: {
                    resourceType,
                    plan: planKey,
                    planName: config.name,
                    months,
                    basePrice,
                    discountRate,
                    discountAmount,
                    finalPrice: finalPriceMajor,
                    scansGranted: config.scansPerMonth * months,
                    creditsGranted: config.scansPerMonth * 2 * months
                }
            };
        }

        if (resourceType === 'credit_pack') {
            const packKey = (resourceId || options.packId || '').toLowerCase();
            const pack = CREDIT_PACKS[packKey];
            if (!pack) {
                const err = new Error(`Invalid credit pack "${packKey}". Allowed packs: "small", "medium", "large".`);
                err.code = ERROR_CODES.VALIDATION_ERROR;
                throw err;
            }

            const amountInMinorUnits = toMinorUnits(pack.price, 'NGN');
            return {
                amountInMinorUnits,
                currency: 'NGN',
                metadataSnapshot: {
                    resourceType,
                    packId: pack.id,
                    packName: pack.name,
                    credits: pack.credits,
                    scans: pack.scans,
                    price: pack.price
                }
            };
        }

        if (resourceType === 'order_deposit') {
            const orderId = resourceId || options.orderId;
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { payments: true }
            });

            if (!order) {
                const err = new Error(`Order ${orderId} not found.`);
                err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
                throw err;
            }

            const totalPaid = (order.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
            const remainingBalance = Math.max(0, (order.totalPrice || 0) - totalPaid);

            if (remainingBalance <= 0) {
                const err = new Error('Order is already fully paid.');
                err.code = ERROR_CODES.VALIDATION_ERROR;
                throw err;
            }

            const depositAmount = options.amount ? Math.min(remainingBalance, Number(options.amount)) : remainingBalance;
            const amountInMinorUnits = toMinorUnits(depositAmount, 'NGN');

            return {
                amountInMinorUnits,
                currency: 'NGN',
                metadataSnapshot: {
                    resourceType,
                    orderId: order.id,
                    orderTotal: order.totalPrice,
                    paidSoFar: totalPaid,
                    chargeAmount: depositAmount
                }
            };
        }

        if (resourceType === 'custom') {
            const customAmount = Math.max(100, Number(options.amount || 1000));
            return {
                amountInMinorUnits: toMinorUnits(customAmount, 'NGN'),
                currency: 'NGN',
                metadataSnapshot: {
                    resourceType,
                    customAmount
                }
            };
        }

        const err = new Error(`Unsupported resourceType "${resourceType}".`);
        err.code = ERROR_CODES.VALIDATION_ERROR;
        throw err;
    }

    /**
     * Initialize payment with full idempotency and state safety (#1, #2, #3, #4)
     */
    async initializePayment({
        tenantId,
        userId,
        customerEmail,
        customerName,
        resourceType,
        resourceId,
        options = {},
        idempotencyKey,
        callbackUrl,
        ipAddress,
        userAgent
    }) {
        // Principle #1: Idempotency Check
        if (idempotencyKey) {
            const existingPayment = await this.repository.findByIdempotencyKey(idempotencyKey);
            if (existingPayment) {
                const latestAttempt = existingPayment.attempts?.[existingPayment.attempts.length - 1];
                return {
                    idempotentReplay: true,
                    payment: existingPayment,
                    authorizationUrl: latestAttempt?.authorizationUrl,
                    accessCode: latestAttempt?.accessCode,
                    reference: existingPayment.paymentReference,
                    status: existingPayment.status
                };
            }
        }

        // Principle #3 & #4: Authoritative price calculation
        const {
            amountInMinorUnits,
            currency,
            metadataSnapshot
        } = await this.calculateAuthoritativeAmount(resourceType, resourceId, options);

        // Principle #2: Unique internal reference
        const paymentReference = this.generatePaymentReference();
        const effectiveIdempotencyKey = idempotencyKey || `IDEM-${paymentReference}`;

        // Principle #13: Create payment snapshot in database
        const payment = await this.repository.createPayment({
            tenantId,
            userId,
            resourceType,
            resourceId,
            idempotencyKey: effectiveIdempotencyKey,
            paymentReference,
            amount: amountInMinorUnits,
            currency,
            fees: 0,
            totalAmount: amountInMinorUnits,
            customerEmail,
            customerName,
            metadata: {
                ...metadataSnapshot,
                clientOptions: options,
                callbackUrl
            },
            provider: this.provider.providerName
        });

        // Initialize with gateway provider
        let gatewayResult;
        try {
            gatewayResult = await this.provider.initializeTransaction({
                reference: paymentReference,
                amountInMinorUnits,
                currency,
                email: customerEmail,
                callbackUrl,
                metadata: {
                    paymentId: payment.id,
                    paymentReference,
                    tenantId,
                    userId,
                    resourceType
                }
            });
        } catch (err) {
            // Record failed attempt and transition to FAILED (#15, #17)
            await this.repository.recordPaymentAttempt({
                paymentId: payment.id,
                status: PAYMENT_STATES.FAILED,
                provider: this.provider.providerName,
                errorMessage: err.message,
                ipAddress,
                userAgent
            });

            await this.repository.transitionPaymentState({
                paymentReference,
                nextState: PAYMENT_STATES.FAILED,
                metadataUpdate: { initializationError: err.message },
                actor: userId || 'system',
                source: 'gateway_init'
            });

            throw err;
        }

        // Record successful attempt (#15)
        const attempt = await this.repository.recordPaymentAttempt({
            paymentId: payment.id,
            status: PAYMENT_STATES.INITIALIZED,
            provider: this.provider.providerName,
            providerReference: gatewayResult.providerReference,
            authorizationUrl: gatewayResult.authorizationUrl,
            accessCode: gatewayResult.accessCode,
            responsePayload: gatewayResult.rawResponse,
            ipAddress,
            userAgent
        });

        // Advance state machine to INITIALIZED (#5)
        const updatedPayment = await this.repository.transitionPaymentState({
            paymentReference,
            nextState: PAYMENT_STATES.INITIALIZED,
            providerReference: gatewayResult.providerReference,
            providerStatus: 'initialized',
            metadataUpdate: { authorizationUrl: gatewayResult.authorizationUrl }
        });

        return {
            idempotentReplay: false,
            payment: updatedPayment,
            attempt,
            reference: paymentReference,
            authorizationUrl: gatewayResult.authorizationUrl,
            accessCode: gatewayResult.accessCode,
            amount: toMajorUnits(amountInMinorUnits, currency),
            amountInMinorUnits,
            currency,
            status: updatedPayment.status
        };
    }

    /**
     * Verify payment status with gateway and fulfill atomically (#9, #10, #11, #19, #21)
     */
    async verifyPayment(paymentReference, options = {}) {
        const payment = await this.repository.findByReference(paymentReference);
        if (!payment) {
            const err = new Error(`Payment reference ${paymentReference} not found`);
            err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
            throw err;
        }

        // Principle #19: Race condition guard - if already SUCCESS, return immediately
        if (payment.status === PAYMENT_STATES.SUCCESS) {
            let fulfillment = null;
            if (payment.tenantId) {
                const tenant = await prisma.tenant.findUnique({ where: { id: payment.tenantId } });
                if (tenant) {
                    fulfillment = {
                        tokenBalance: tenant.tokenBalance,
                        plan: tenant.settings?.plan,
                        planExpiresAt: tenant.settings?.planExpiresAt
                    };
                }
            }
            return {
                alreadyProcessed: true,
                success: true,
                payment,
                status: payment.status,
                reference: payment.paymentReference,
                amount: toMajorUnits(payment.amount, payment.currency),
                fulfillment
            };
        }

        // Advance to PROCESSING (#5)
        try {
            await this.repository.transitionPaymentState({
                paymentReference,
                nextState: PAYMENT_STATES.PROCESSING,
                actor: options.actor || 'system',
                source: options.source || 'verify_call'
            });
        } catch (stateErr) {
            if (stateErr.code !== ERROR_CODES.INVALID_STATE_TRANSITION) throw stateErr;
        }

        // Principle #9: Verify with server-side provider API
        const providerData = await this.provider.verifyTransaction(paymentReference);

        // Principle #10: Verify Amount
        const reportedAmount = Number(providerData.amount);
        const expectedAmount = Number(payment.amount);
        const requestedAmount = providerData.requestedAmount !== undefined && providerData.requestedAmount !== null
            ? Number(providerData.requestedAmount)
            : null;
        const fees = Number(providerData.fees || 0);
        const netAmount = reportedAmount - fees;

        // Support both direct amount match and fee-adjusted match (where gateway adds transaction fee to customer)
        const isAmountMatch =
            reportedAmount === expectedAmount ||
            (requestedAmount !== null && requestedAmount === expectedAmount) ||
            (fees > 0 && Math.abs(netAmount - expectedAmount) <= 10);

        if (!isAmountMatch) {
            await this.repository.transitionPaymentState({
                paymentReference,
                nextState: PAYMENT_STATES.FAILED,
                providerReference: providerData.providerReference,
                providerStatus: providerData.providerStatus,
                metadataUpdate: {
                    mismatchError: 'AMOUNT_MISMATCH',
                    expectedAmount: payment.amount,
                    reportedAmount: providerData.amount,
                    requestedAmount: providerData.requestedAmount,
                    fees: providerData.fees
                },
                actor: 'verification_engine'
            });

            const err = new Error(
                `Amount mismatch! Expected ${payment.amount} minor units, gateway reported ${providerData.amount}`
            );
            err.code = ERROR_CODES.AMOUNT_MISMATCH;
            throw err;
        }

        // Principle #11: Verify Currency
        if ((providerData.currency || '').toUpperCase() !== (payment.currency || '').toUpperCase()) {
            await this.repository.transitionPaymentState({
                paymentReference,
                nextState: PAYMENT_STATES.FAILED,
                providerReference: providerData.providerReference,
                providerStatus: providerData.providerStatus,
                metadataUpdate: {
                    mismatchError: 'CURRENCY_MISMATCH',
                    expectedCurrency: payment.currency,
                    reportedCurrency: providerData.currency
                },
                actor: 'verification_engine'
            });

            const err = new Error(
                `Currency mismatch! Expected ${payment.currency}, gateway reported ${providerData.currency}`
            );
            err.code = ERROR_CODES.CURRENCY_MISMATCH;
            throw err;
        }

        // Check verification outcome
        if (providerData.status === PAYMENT_STATES.SUCCESS) {
            // Mark payment SUCCESS
            const isRecovery = payment.status === PAYMENT_STATES.FAILED || payment.status === PAYMENT_STATES.ABANDONED;
            const updatedPayment = await this.repository.transitionPaymentState({
                paymentReference,
                nextState: PAYMENT_STATES.SUCCESS,
                providerReference: providerData.providerReference,
                providerStatus: providerData.providerStatus,
                metadataUpdate: {
                    paidAt: providerData.paidAt,
                    channel: providerData.channel,
                    gatewayResponse: providerData.gatewayResponse,
                    ...(isRecovery ? { recoveredFromState: payment.status } : {})
                },
                actor: options.actor || 'system',
                source: options.source || 'verify_call',
                force: isRecovery
            });

            // Principle #14 & #21 & #24: Atomic domain fulfillment & queue async jobs
            const fulfillment = await this.fulfillPayment(updatedPayment);

            return {
                alreadyProcessed: false,
                success: true,
                payment: updatedPayment,
                status: PAYMENT_STATES.SUCCESS,
                reference: paymentReference,
                amount: toMajorUnits(payment.amount, payment.currency),
                fulfillment
            };
        } else {
            const finalFailedState = providerData.status === PAYMENT_STATES.ABANDONED
                ? PAYMENT_STATES.ABANDONED
                : PAYMENT_STATES.FAILED;

            const updatedPayment = await this.repository.transitionPaymentState({
                paymentReference,
                nextState: finalFailedState,
                providerReference: providerData.providerReference,
                providerStatus: providerData.providerStatus,
                actor: options.actor || 'system',
                source: options.source || 'verify_call'
            });

            return {
                alreadyProcessed: false,
                success: false,
                payment: updatedPayment,
                status: finalFailedState,
                reference: paymentReference,
                message: `Payment not completed: status is ${providerData.providerStatus}`
            };
        }
    }

    /**
     * Fulfill business resources atomically upon verified payment (#14, #21)
     */
    async fulfillPayment(payment) {
        const { resourceType, resourceId, tenantId, metadata, paymentReference } = payment;

        if (resourceType === 'subscription_plan') {
            let planKey = (resourceId || metadata?.plan || 'standard').toLowerCase();
            if (planKey === 'studio') planKey = 'premium';
            const months = Number(metadata?.months) || 1;
            const config = PLAN_LIMITS[planKey] || PLAN_LIMITS.standard;
            const creditsGranted = Number(metadata?.creditsGranted) || (config.scansPerMonth * 2 * months);

            await prisma.$transaction(async (tx) => {
                const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
                if (!tenant) return;

                const now = new Date();
                const existingSettings = tenant.settings || {};
                const currentExpires = existingSettings.planExpiresAt ? new Date(existingSettings.planExpiresAt) : null;
                let baseDate = now;
                if (currentExpires && currentExpires.getTime() > now.getTime()) {
                    baseDate = currentExpires;
                }
                const newExpires = new Date(baseDate.getTime() + months * 30 * 24 * 60 * 60 * 1000);

                const updatedSettings = {
                    ...existingSettings,
                    plan: planKey,
                    planExpiresAt: newExpires.toISOString(),
                    lastPlanPurchase: {
                        plan: planKey,
                        months,
                        finalPrice: toMajorUnits(payment.amount, payment.currency),
                        creditsGranted,
                        reference: paymentReference,
                        purchasedAt: now.toISOString()
                    }
                };

                await tx.tenant.update({
                    where: { id: tenantId },
                    data: {
                        settings: updatedSettings,
                        tokenBalance: { increment: creditsGranted }
                    }
                });

                await tx.tokenTransaction.create({
                    data: {
                        tenantId,
                        amount: creditsGranted,
                        type: 'plan_scans_granted',
                        description: `Payment Verified: Prepaid ${config.name} plan (${months} mo): +${creditsGranted} scan credits [Ref: ${paymentReference}]`
                    }
                });
            });
        } else if (resourceType === 'credit_pack') {
            const packKey = (resourceId || metadata?.packId || 'small').toLowerCase();
            const pack = CREDIT_PACKS[packKey];
            const credits = pack?.credits || metadata?.credits || 20;

            await prisma.$transaction(async (tx) => {
                await tx.tenant.update({
                    where: { id: tenantId },
                    data: { tokenBalance: { increment: credits } }
                });

                await tx.tokenTransaction.create({
                    data: {
                        tenantId,
                        amount: credits,
                        type: 'purchase',
                        description: `Payment Verified: Credit Pack (${pack?.name || packKey}) +${credits} credits [Ref: ${paymentReference}]`
                    }
                });
            });
        } else if (resourceType === 'order_deposit') {
            const orderId = resourceId || metadata?.orderId;
            if (orderId) {
                const majorAmount = toMajorUnits(payment.amount, payment.currency);
                await prisma.orderPayment.create({
                    data: {
                        orderId,
                        amount: majorAmount,
                        method: 'paystack',
                        type: 'deposit'
                    }
                });
            }
        }

        // Principle #25: Queue asynchronous background tasks (receipts, notification, ledger sync)
        await this.repository.createJob('PAYMENT_RECEIPT', {
            paymentId: payment.id,
            paymentReference: payment.paymentReference,
            customerEmail: payment.customerEmail,
            amount: toMajorUnits(payment.amount, payment.currency),
            currency: payment.currency
        });

        let tenantInfo = null;
        if (tenantId) {
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
            if (tenant) {
                tenantInfo = {
                    tokenBalance: tenant.tokenBalance,
                    plan: tenant.settings?.plan,
                    planExpiresAt: tenant.settings?.planExpiresAt
                };
            }
        }
        return tenantInfo;
    }

    /**
     * Get payment details by reference
     */
    async getPaymentByReference(reference) {
        const payment = await this.repository.findByReference(reference);
        if (!payment) {
            const err = new Error(`Payment reference ${reference} not found`);
            err.code = ERROR_CODES.RESOURCE_NOT_FOUND;
            throw err;
        }
        return payment;
    }
}

module.exports = new PaymentService();
