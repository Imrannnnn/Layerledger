/**
 * LayerLedger Payment Gateway Validation Schemas
 * Adheres to Principles:
 * #3 (Backend Authority), #4 (Never Trust Frontend Amount), #37 (Validate All Incoming Data)
 */

const { z } = require('zod');

const initializePaymentSchema = z.object({
    resourceType: z.enum(['subscription_plan', 'credit_pack', 'order_deposit', 'custom'], {
        errorMap: () => ({ message: 'Invalid resourceType. Allowed: subscription_plan, credit_pack, order_deposit, custom' })
    }),
    resourceId: z.string().min(1, 'resourceId is required').optional(),
    idempotencyKey: z.string().min(8, 'idempotencyKey must be at least 8 characters').optional(),
    options: z.object({
        months: z.number().int().refine((val) => [1, 3, 6, 12].includes(val), {
            message: 'Months must be 1, 3, 6, or 12'
        }).optional(),
        packId: z.string().optional(),
        orderId: z.string().optional()
    }).optional(),
    paymentMethod: z.string().optional(),
    callbackUrl: z.string().url('Invalid callbackUrl').optional()
});

const verifyPaymentSchema = z.object({
    reference: z.string().min(3, 'Payment reference is required')
});

const refundPaymentSchema = z.object({
    paymentReference: z.string().min(3, 'Payment reference is required'),
    amount: z.number().positive('Refund amount must be greater than zero').optional(),
    amountInMinorUnits: z.number().int().positive().optional(),
    reason: z.string().max(255).optional(),
    idempotencyKey: z.string().min(8, 'idempotencyKey is required for refund requests')
});

module.exports = {
    initializePaymentSchema,
    verifyPaymentSchema,
    refundPaymentSchema
};
