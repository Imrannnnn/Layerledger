const { z } = require('zod');

const superadminLoginSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email('Invalid email address'),
        password: z.string().min(1, 'Password is required')
    })
});

const updateTenantStatusSchema = z.object({
    body: z.object({
        status: z.enum(['Active', 'Suspended'], {
            errorMap: () => ({ message: 'Invalid status value' })
        })
    })
});

const adjustTenantTokensSchema = z.object({
    body: z.object({
        amount: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val), 'Valid amount is required'),
        description: z.string().optional()
    })
});

const grantPremiumSchema = z.object({
    body: z.object({
        days: z.union([z.number(), z.string()])
            .transform(val => parseInt(val, 10))
            .refine(val => !isNaN(val) && val >= 1, 'Duration must be at least 1 day'),
        bonusCredits: z.union([z.number(), z.string()])
            .optional()
            .transform(val => (val !== undefined && val !== '') ? parseInt(val, 10) : 0)
            .refine(val => !isNaN(val) && val >= 0, 'Bonus credits must be a valid number'),
        notifyEmail: z.boolean().optional().default(true),
        note: z.string().optional()
    })
});

module.exports = {
    superadminLoginSchema,
    updateTenantStatusSchema,
    adjustTenantTokensSchema,
    grantPremiumSchema
};
