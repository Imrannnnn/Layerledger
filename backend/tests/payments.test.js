const crypto = require('crypto');

// Create mock Prisma client
const mockPrisma = {
    payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    },
    paymentAttempt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn()
    },
    paymentWebhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    },
    paymentRefund: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
    },
    paymentAuditEvent: {
        create: jest.fn()
    },
    paymentJob: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn()
    },
    tenant: {
        findUnique: jest.fn(),
        update: jest.fn()
    },
    tokenTransaction: {
        create: jest.fn()
    },
    order: {
        findUnique: jest.fn()
    },
    orderPayment: {
        create: jest.fn()
    },
    $transaction: jest.fn((callback) => callback(mockPrisma))
};

jest.mock('../prisma', () => mockPrisma);

const {
    PAYMENT_STATES,
    REFUND_STATES,
    toMinorUnits,
    toMajorUnits,
    isValidTransition
} = require('../modules/payments/payment.constants');

const paymentRepository = require('../modules/payments/payment.repository');
const PaymentServiceClass = require('../modules/payments/payment.service').constructor;
const WebhookServiceClass = require('../modules/payments/webhook/webhook.service').constructor;
const RefundServiceClass = require('../modules/payments/refunds/refund.service').constructor;
const ReconciliationWorkerClass = require('../jobs/reconciliationJobs').constructor;
const PaystackProvider = require('../modules/payments/providers/paystack.provider');

describe('LayerLedger Payment Gateway Engineering Principles (50 Principles Verification)', () => {
    let mockProvider;
    let paymentService;
    let webhookService;
    let refundService;
    let reconciliationWorker;

    const testSecret = 'sk_test_7033a2466dd4dfd390b748e52d4235cf4dfba7bd';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.PAYSTACK_SECRET_KEY = testSecret;

        mockProvider = new PaystackProvider();
        // Mock provider network calls
        mockProvider.initializeTransaction = jest.fn().mockResolvedValue({
            success: true,
            provider: 'paystack',
            providerReference: 'PSTK-REF-123',
            authorizationUrl: 'https://checkout.paystack.com/authorize123',
            accessCode: 'acc_123',
            rawResponse: { status: true }
        });

        mockProvider.verifyTransaction = jest.fn().mockResolvedValue({
            success: true,
            provider: 'paystack',
            providerReference: 'PSTK-REF-123',
            amount: 500000, // 5000 NGN in kobo
            currency: 'NGN',
            status: PAYMENT_STATES.SUCCESS,
            providerStatus: 'success',
            paidAt: new Date().toISOString()
        });

        mockProvider.processRefund = jest.fn().mockResolvedValue({
            success: true,
            provider: 'paystack',
            providerReference: 'PSTK-REFUND-999',
            status: PAYMENT_STATES.SUCCESS,
            rawResponse: { status: true }
        });

        paymentService = new PaymentServiceClass(mockProvider, paymentRepository);
        webhookService = new WebhookServiceClass(mockProvider, paymentRepository, paymentService);
        refundService = new RefundServiceClass(mockProvider, paymentRepository);
        reconciliationWorker = new ReconciliationWorkerClass(mockProvider, paymentRepository, paymentService);
    });

    describe('Principle 12: Safe Money Representation (Integer Minor Units)', () => {
        test('correctly converts major financial currency to minor integer units (kobo)', () => {
            expect(toMinorUnits(5000, 'NGN')).toBe(500000);
            expect(toMinorUnits(100.50, 'NGN')).toBe(10050);
            expect(toMinorUnits(0, 'NGN')).toBe(0);
        });

        test('correctly converts minor integer units back to major currency', () => {
            expect(toMajorUnits(500000, 'NGN')).toBe(5000);
            expect(toMajorUnits(10050, 'NGN')).toBe(100.5);
        });
    });

    describe('Principles 3 & 4: Backend Is Authority & Never Trust Frontend Amount', () => {
        test('calculates exact authoritative amount for Standard plan (1 month = ₦5,000)', async () => {
            const result = await paymentService.calculateAuthoritativeAmount('subscription_plan', 'standard', { months: 1 });
            expect(result.amountInMinorUnits).toBe(500000); // 5000 NGN
            expect(result.currency).toBe('NGN');
            expect(result.metadataSnapshot.finalPrice).toBe(5000);
        });

        test('applies multi-month discount authoritatively (3 months @ 5% discount)', async () => {
            const result = await paymentService.calculateAuthoritativeAmount('subscription_plan', 'standard', { months: 3 });
            // Base = 15,000, Discount = 750, Final = 14,250 NGN -> 1,425,000 kobo
            expect(result.amountInMinorUnits).toBe(1425000);
            expect(result.metadataSnapshot.discountAmount).toBe(750);
            expect(result.metadataSnapshot.finalPrice).toBe(14250);
        });

        test('calculates exact authoritative amount for credit packs (small = ₦3,000)', async () => {
            const result = await paymentService.calculateAuthoritativeAmount('credit_pack', 'small');
            expect(result.amountInMinorUnits).toBe(300000);
            expect(result.metadataSnapshot.credits).toBe(20);
        });

        test('rejects invalid plan or resource types', async () => {
            await expect(paymentService.calculateAuthoritativeAmount('subscription_plan', 'enterprise'))
                .rejects.toThrow(/Invalid plan/);

            await expect(paymentService.calculateAuthoritativeAmount('unknown_resource', '123'))
                .rejects.toThrow(/Unsupported resourceType/);
        });
    });

    describe('Principle 1: Idempotency', () => {
        test('returns existing payment and prevents duplicate charge when idempotencyKey matches', async () => {
            const existing = {
                id: 'pay-1',
                idempotencyKey: 'IDEM-KEY-EXISTING',
                paymentReference: 'LL-PAY-OLD',
                amount: 500000,
                currency: 'NGN',
                status: PAYMENT_STATES.INITIALIZED,
                attempts: [{ authorizationUrl: 'https://checkout.paystack.com/old', accessCode: 'acc_old_123' }]
            };

            mockPrisma.payment.findUnique.mockResolvedValueOnce(existing);

            const result = await paymentService.initializePayment({
                tenantId: 'tenant-1',
                userId: 'user-1',
                customerEmail: 'test@bakewealth.com',
                resourceType: 'subscription_plan',
                resourceId: 'standard',
                options: { months: 1 },
                idempotencyKey: 'IDEM-KEY-EXISTING'
            });

            expect(result.idempotentReplay).toBe(true);
            expect(result.reference).toBe('LL-PAY-OLD');
            expect(result.authorizationUrl).toBe('https://checkout.paystack.com/old');
            expect(result.accessCode).toBe('acc_old_123');
            // Provider was NOT called again (#1)
            expect(mockProvider.initializeTransaction).not.toHaveBeenCalled();
        });
    });

    describe('Principle 2: Unique Payment Reference', () => {
        test('generates unique payment references with timestamp and randomness', () => {
            const ref1 = paymentService.generatePaymentReference();
            const ref2 = paymentService.generatePaymentReference();
            expect(ref1).toMatch(/^LL-PAY-[A-Z0-9]+-[A-Z0-9]+$/);
            expect(ref2).toMatch(/^LL-PAY-[A-Z0-9]+-[A-Z0-9]+$/);
            expect(ref1).not.toBe(ref2);
        });
    });

    describe('Principle 5: Payment State Machine & Transition Guards', () => {
        test('allows valid state progression: PENDING -> INITIALIZED -> PROCESSING -> SUCCESS', () => {
            expect(isValidTransition(PAYMENT_STATES.PENDING, PAYMENT_STATES.INITIALIZED)).toBe(true);
            expect(isValidTransition(PAYMENT_STATES.INITIALIZED, PAYMENT_STATES.PROCESSING)).toBe(true);
            expect(isValidTransition(PAYMENT_STATES.PROCESSING, PAYMENT_STATES.SUCCESS)).toBe(true);
        });

        test('prohibits invalid transitions: SUCCESS cannot revert to PENDING or INITIALIZED', () => {
            expect(isValidTransition(PAYMENT_STATES.SUCCESS, PAYMENT_STATES.PENDING)).toBe(false);
            expect(isValidTransition(PAYMENT_STATES.SUCCESS, PAYMENT_STATES.INITIALIZED)).toBe(false);
            expect(isValidTransition(PAYMENT_STATES.FAILED, PAYMENT_STATES.SUCCESS)).toBe(false);
        });
    });

    describe('Principles 7 & 8: Webhook Signatures & Idempotency', () => {
        test('validates authentic Paystack HMAC SHA512 signature', () => {
            const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'LL-PAY-123' } });
            const validSignature = crypto
                .createHmac('sha512', testSecret)
                .update(Buffer.from(rawBody, 'utf8'))
                .digest('hex');

            expect(mockProvider.verifyWebhookSignature(rawBody, validSignature)).toBe(true);
        });

        test('rejects tampered body or invalid signature', async () => {
            const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'LL-PAY-123' } });
            const tamperedSignature = 'bad0000000000000000000000000000000000000000000000000000000000000';

            await expect(webhookService.handleWebhook(rawBody, tamperedSignature, JSON.parse(rawBody)))
                .rejects.toThrow(/Invalid webhook cryptographic signature/);
        });

        test('safely ignores duplicate webhook event (#8)', async () => {
            const payload = { event: 'charge.success', id: 'evt_dup_123', data: { reference: 'LL-PAY-123' } };
            const rawBody = JSON.stringify(payload);
            const signature = crypto.createHmac('sha512', testSecret).update(rawBody).digest('hex');

            // Webhook event already in database
            mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({
                id: 'w-1',
                eventId: 'evt_dup_123',
                status: 'PROCESSED'
            });

            const result = await webhookService.handleWebhook(rawBody, signature, payload);
            expect(result.status).toBe('ignored');
            expect(result.message).toContain('Duplicate webhook event already processed');
            // Did not trigger verification again
            expect(mockProvider.verifyTransaction).not.toHaveBeenCalled();
        });
    });

    describe('Principles 9, 10 & 11: Transaction, Amount & Currency Verification', () => {
        test('successfully verifies transaction matching expected amount and currency', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-VALID',
                amount: 500000,
                currency: 'NGN',
                status: PAYMENT_STATES.INITIALIZED,
                tenantId: 'tenant-1',
                resourceType: 'subscription_plan',
                resourceId: 'standard',
                metadata: { plan: 'standard', months: 1, creditsGranted: 40 }
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            mockPrisma.payment.update.mockResolvedValue({
                ...paymentRecord,
                status: PAYMENT_STATES.SUCCESS
            });
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', settings: {} });

            const result = await paymentService.verifyPayment('LL-PAY-VALID');

            expect(result.success).toBe(true);
            expect(result.status).toBe(PAYMENT_STATES.SUCCESS);
            expect(mockProvider.verifyTransaction).toHaveBeenCalledWith('LL-PAY-VALID');
        });

        test('Principle 10: Rejects verification when amount does not match expected amount', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-MISMATCH',
                amount: 500000, // expected 5,000 NGN
                currency: 'NGN',
                status: PAYMENT_STATES.INITIALIZED
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            // Provider reports lower amount (e.g. 500 NGN = 50,000 kobo)
            mockProvider.verifyTransaction.mockResolvedValueOnce({
                success: true,
                amount: 50000,
                currency: 'NGN',
                status: PAYMENT_STATES.SUCCESS
            });

            await expect(paymentService.verifyPayment('LL-PAY-MISMATCH'))
                .rejects.toThrow(/Amount mismatch/);
        });

        test('Principle 10: Accepts verification when gateway amount includes customer-borne fee with requestedAmount or fees', async () => {
            const paymentRecord = {
                id: 'pay-fee-1',
                paymentReference: 'LL-PAY-FEE-MATCH',
                amount: 300000, // expected 3,000 NGN
                currency: 'NGN',
                status: PAYMENT_STATES.INITIALIZED,
                tenantId: 'tenant-1',
                resourceType: 'credit_pack',
                resourceId: 'small',
                metadata: { credits: 20 }
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            mockPrisma.payment.update.mockResolvedValue({
                ...paymentRecord,
                status: PAYMENT_STATES.SUCCESS
            });
            mockPrisma.tenant.update.mockResolvedValue({});
            mockPrisma.tokenTransaction.create.mockResolvedValue({});

            // Paystack reports 3,147.21 NGN (314,721 kobo) due to 1.5% + 100 fee passed to customer
            mockProvider.verifyTransaction.mockResolvedValueOnce({
                success: true,
                amount: 314721,
                requestedAmount: 300000,
                fees: 14721,
                currency: 'NGN',
                status: PAYMENT_STATES.SUCCESS
            });

            const result = await paymentService.verifyPayment('LL-PAY-FEE-MATCH');
            expect(result.success).toBe(true);
            expect(result.status).toBe(PAYMENT_STATES.SUCCESS);
        });

        test('Principle 5 & 10: Allows recovery to SUCCESS from FAILED state upon valid verification', async () => {
            const paymentRecord = {
                id: 'pay-failed-rec',
                paymentReference: 'LL-PAY-RECOVERY',
                amount: 300000,
                currency: 'NGN',
                status: PAYMENT_STATES.FAILED,
                tenantId: 'tenant-1',
                resourceType: 'credit_pack',
                resourceId: 'small',
                metadata: { credits: 20 }
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            mockPrisma.payment.update.mockResolvedValue({
                ...paymentRecord,
                status: PAYMENT_STATES.SUCCESS
            });
            mockPrisma.tenant.update.mockResolvedValue({});
            mockPrisma.tokenTransaction.create.mockResolvedValue({});

            mockProvider.verifyTransaction.mockResolvedValueOnce({
                success: true,
                amount: 314721,
                requestedAmount: 300000,
                fees: 14721,
                currency: 'NGN',
                status: PAYMENT_STATES.SUCCESS
            });

            const result = await paymentService.verifyPayment('LL-PAY-RECOVERY');
            expect(result.success).toBe(true);
            expect(result.status).toBe(PAYMENT_STATES.SUCCESS);
        });

        test('Principle 11: Rejects verification when currency does not match expected currency', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-CURR-MISMATCH',
                amount: 500000,
                currency: 'NGN',
                status: PAYMENT_STATES.INITIALIZED
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            // Provider reports USD
            mockProvider.verifyTransaction.mockResolvedValueOnce({
                success: true,
                amount: 500000,
                currency: 'USD',
                status: PAYMENT_STATES.SUCCESS
            });

            await expect(paymentService.verifyPayment('LL-PAY-CURR-MISMATCH'))
                .rejects.toThrow(/Currency mismatch/);
        });
    });

    describe('Principle 19: Race Conditions Guard', () => {
        test('returns immediate success without re-fulfilling if payment is already SUCCESS', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-ALREADY-SUCCESS',
                amount: 500000,
                currency: 'NGN',
                status: PAYMENT_STATES.SUCCESS
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);

            const result = await paymentService.verifyPayment('LL-PAY-ALREADY-SUCCESS');
            expect(result.alreadyProcessed).toBe(true);
            expect(result.success).toBe(true);
            expect(mockProvider.verifyTransaction).not.toHaveBeenCalled();
        });
    });

    describe('Principles 28, 29 & 30: Refund Architecture & Partial Refunds', () => {
        test('processes partial refund and updates payment state to PARTIALLY_REFUNDED', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-REFUNDABLE',
                amount: 1000000, // ₦10,000 (1,000,000 kobo)
                currency: 'NGN',
                refundedAmount: 0,
                status: PAYMENT_STATES.SUCCESS,
                provider: 'paystack',
                providerReference: 'PSTK-123'
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);
            mockPrisma.paymentRefund.create.mockResolvedValue({
                id: 'ref-1',
                refundReference: 'LL-REF-1',
                amount: 300000, // ₦3,000
                currency: 'NGN',
                status: REFUND_STATES.PENDING,
                payment: paymentRecord
            });
            mockPrisma.paymentRefund.findUnique.mockResolvedValue({
                id: 'ref-1',
                refundReference: 'LL-REF-1',
                amount: 300000,
                currency: 'NGN',
                status: REFUND_STATES.PENDING,
                payment: paymentRecord
            });
            mockPrisma.paymentRefund.update.mockResolvedValue({
                id: 'ref-1',
                refundReference: 'LL-REF-1',
                amount: 300000,
                currency: 'NGN',
                status: REFUND_STATES.SUCCESS
            });

            const result = await refundService.processRefund({
                paymentReference: 'LL-PAY-REFUNDABLE',
                amount: 3000, // ₦3,000
                reason: 'Customer cancelled early'
            });

            expect(result.success).toBe(true);
            expect(result.amount).toBe(3000);
            expect(mockProvider.processRefund).toHaveBeenCalledWith(expect.objectContaining({
                amountInMinorUnits: 300000
            }));
        });

        test('Principle 29: Rejects refund when requested amount exceeds remaining balance', async () => {
            const paymentRecord = {
                id: 'pay-1',
                paymentReference: 'LL-PAY-PARTIAL-LIMIT',
                amount: 500000, // ₦5,000
                refundedAmount: 400000, // ₦4,000 already refunded
                currency: 'NGN',
                status: PAYMENT_STATES.PARTIALLY_REFUNDED
            };

            mockPrisma.payment.findUnique.mockResolvedValue(paymentRecord);

            await expect(refundService.processRefund({
                paymentReference: 'LL-PAY-PARTIAL-LIMIT',
                amount: 2000 // ₦2,000 requested but only ₦1,000 remaining
            })).rejects.toThrow(/exceeds remaining balance/);
        });

        test('Principle 30: Refund idempotency returns existing refund record without second debit', async () => {
            const existingRefund = {
                id: 'ref-idem-1',
                idempotencyKey: 'REF-IDEM-KEY-1',
                refundReference: 'LL-REF-OLD',
                amount: 200000,
                currency: 'NGN',
                status: REFUND_STATES.SUCCESS
            };

            mockPrisma.paymentRefund.findUnique.mockResolvedValueOnce(existingRefund);

            const result = await refundService.processRefund({
                paymentReference: 'LL-PAY-ANY',
                amount: 2000,
                idempotencyKey: 'REF-IDEM-KEY-1'
            });

            expect(result.idempotentReplay).toBe(true);
            expect(result.refundReference).toBe('LL-REF-OLD');
            expect(mockProvider.processRefund).not.toHaveBeenCalled();
        });
    });

    describe('Principles 31 & 32: Reconciliation Worker', () => {
        test('identifies stale pending payments and reconciles successful transactions from gateway', async () => {
            const stalePayments = [
                {
                    id: 'pay-stale-1',
                    paymentReference: 'LL-PAY-STALE-1',
                    amount: 500000,
                    currency: 'NGN',
                    status: PAYMENT_STATES.INITIALIZED,
                    createdAt: new Date(Date.now() - 30 * 60 * 1000)
                }
            ];

            mockPrisma.payment.findMany.mockResolvedValueOnce(stalePayments);
            mockPrisma.payment.findUnique.mockResolvedValue(stalePayments[0]);
            mockPrisma.payment.update.mockResolvedValue({
                ...stalePayments[0],
                status: PAYMENT_STATES.SUCCESS
            });
            mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', settings: {} });

            const report = await reconciliationWorker.reconcileStalePayments(15);
            expect(report.checkedCount).toBe(1);
            expect(report.reconciledSuccess).toBe(1);
            expect(report.discrepancies.length).toBe(1);
            expect(report.discrepancies[0].resolution).toBe('RESOLVED_TO_SUCCESS');
        });
    });
});
