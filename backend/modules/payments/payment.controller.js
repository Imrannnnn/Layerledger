/**
 * LayerLedger Payment Controller
 * Adheres to Principles:
 * #1 (Idempotency), #3 (Backend Authority), #37 (Validation),
 * #38 (Auth & Permissions), #47 (Error Classification), #48 (Safe Error Responses)
 */

const paymentService = require('./payment.service');
const { initializePaymentSchema, verifyPaymentSchema } = require('./payment.validation');
const { ERROR_CODES, toMajorUnits } = require('./payment.constants');
const prisma = require('../../prisma');

/**
 * Initialize payment
 * POST /api/payments/initialize
 */
const initializePayment = async (req, res) => {
    const validation = initializePaymentSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            status: 'error',
            code: ERROR_CODES.VALIDATION_ERROR,
            message: validation.error.errors[0]?.message || 'Invalid request body'
        });
    }

    const { resourceType, resourceId, idempotencyKey, options, callbackUrl } = validation.data;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const customerEmail = req.user?.email || req.body.email;
    const customerName = req.user?.name || req.body.name;

    if (!customerEmail) {
        return res.status(400).json({
            status: 'error',
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Customer email is required'
        });
    }

    try {
        const result = await paymentService.initializePayment({
            tenantId,
            userId,
            customerEmail,
            customerName,
            resourceType,
            resourceId,
            options,
            idempotencyKey,
            callbackUrl,
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error('[Initialize Payment Error]:', err);

        const status = err.code === ERROR_CODES.VALIDATION_ERROR ? 400
            : err.code === ERROR_CODES.RESOURCE_NOT_FOUND ? 404
            : err.code === ERROR_CODES.AUTHORIZATION_ERROR ? 403
            : 500;

        return res.status(status).json({
            status: 'error',
            code: err.code || ERROR_CODES.INTERNAL_ERROR,
            message: err.message || 'Payment initialization failed. Please try again.'
        });
    }
};

/**
 * Verify payment
 * POST /api/payments/verify
 */
const verifyPayment = async (req, res) => {
    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            status: 'error',
            code: ERROR_CODES.VALIDATION_ERROR,
            message: validation.error.errors[0]?.message || 'Reference is required'
        });
    }

    const { reference } = validation.data;

    try {
        const result = await paymentService.verifyPayment(reference, {
            actor: req.user?.id || 'client',
            source: 'client_verify'
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error('[Verify Payment Error]:', err);

        const status = (err.code === ERROR_CODES.AMOUNT_MISMATCH || err.code === ERROR_CODES.CURRENCY_MISMATCH) ? 400
            : err.code === ERROR_CODES.RESOURCE_NOT_FOUND ? 404
            : 500;

        return res.status(status).json({
            status: 'error',
            code: err.code || ERROR_CODES.INTERNAL_ERROR,
            message: err.message || 'Payment verification failed'
        });
    }
};

/**
 * Get payment status and details by reference
 * GET /api/payments/:reference
 */
const getPaymentStatus = async (req, res) => {
    const { reference } = req.params;

    try {
        const payment = await paymentService.getPaymentByReference(reference);

        // Security check: user must belong to same tenant unless superadmin
        if (req.user?.role !== 'superadmin' && payment.tenantId && payment.tenantId !== req.user?.tenantId) {
            return res.status(403).json({
                status: 'error',
                code: ERROR_CODES.AUTHORIZATION_ERROR,
                message: 'Forbidden: Access denied to this payment record'
            });
        }

        return res.status(200).json({
            id: payment.id,
            reference: payment.paymentReference,
            status: payment.status,
            amount: toMajorUnits(payment.amount, payment.currency),
            currency: payment.currency,
            resourceType: payment.resourceType,
            resourceId: payment.resourceId,
            refundedAmount: toMajorUnits(payment.refundedAmount || 0, payment.currency),
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt
        });
    } catch (err) {
        return res.status(404).json({
            status: 'error',
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: err.message || 'Payment record not found'
        });
    }
};

/**
 * Get payment history for the tenant
 * GET /api/payments
 */
const getTenantPayments = async (req, res) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
        return res.status(400).json({ message: 'Tenant identifier missing' });
    }

    try {
        const payments = await prisma.payment.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            include: { refunds: true }
        });

        const formatted = payments.map((p) => ({
            id: p.id,
            reference: p.paymentReference,
            status: p.status,
            amount: toMajorUnits(p.amount, p.currency),
            currency: p.currency,
            resourceType: p.resourceType,
            resourceId: p.resourceId,
            refundedAmount: toMajorUnits(p.refundedAmount || 0, p.currency),
            createdAt: p.createdAt
        }));

        return res.status(200).json(formatted);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = {
    initializePayment,
    verifyPayment,
    getPaymentStatus,
    getTenantPayments
};
