/**
 * LayerLedger Refund Controller
 * Adheres to Principles:
 * #28-#30 (Refunds), #37 (Validation), #38 (Auth), #48 (Safe Error Responses)
 */

const refundService = require('./refund.service');
const { refundPaymentSchema } = require('../payment.validation');
const { ERROR_CODES } = require('../payment.constants');

const initiateRefund = async (req, res) => {
    // Principle #38: Authorization Check - Only owner or superadmin can issue refunds
    const userRole = req.user?.role;
    if (userRole !== 'owner' && userRole !== 'superadmin') {
        return res.status(403).json({
            status: 'error',
            code: ERROR_CODES.AUTHORIZATION_ERROR,
            message: 'Forbidden: Only owner or superadmin can process refunds'
        });
    }

    const validation = refundPaymentSchema.safeParse(req.body);
    if (!validation.success) {
        return res.status(400).json({
            status: 'error',
            code: ERROR_CODES.VALIDATION_ERROR,
            message: validation.error.errors[0]?.message || 'Validation failed'
        });
    }

    const { paymentReference, amount, amountInMinorUnits, reason, idempotencyKey } = validation.data;

    try {
        const result = await refundService.processRefund({
            paymentReference,
            amount,
            amountInMinorUnits,
            reason,
            idempotencyKey,
            requestedBy: req.user?.id || 'admin'
        });

        return res.status(200).json(result);
    } catch (err) {
        console.error('[Refund Controller Error]:', err);

        const status = err.code === ERROR_CODES.REFUND_LIMIT_EXCEEDED ? 400
            : err.code === ERROR_CODES.RESOURCE_NOT_FOUND ? 404
            : 500;

        return res.status(status).json({
            status: 'error',
            code: err.code || ERROR_CODES.INTERNAL_ERROR,
            message: err.message || 'Refund processing failed'
        });
    }
};

module.exports = {
    initiateRefund
};
