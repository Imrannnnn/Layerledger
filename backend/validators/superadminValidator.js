const { z } = require('zod');

const superadminLoginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
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

module.exports = {
    superadminLoginSchema,
    updateTenantStatusSchema,
    adjustTenantTokensSchema
};
