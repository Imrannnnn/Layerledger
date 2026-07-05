const { z } = require('zod');

const createTransactionSchema = z.object({
    body: z.object({
        date: z.string().datetime().optional().or(z.date().optional()),
        description: z.string().trim().min(1, 'Description is required'),
        amount: z.number().nonnegative('Valid non-negative amount is required'),
        type: z.string().trim().min(1, 'Type is required'),
        category: z.string().optional(),
        reference: z.string().optional()
    })
});

const updateTransactionSchema = z.object({
    body: z.object({
        date: z.string().datetime().optional().or(z.date().optional()),
        description: z.string().trim().min(1, 'Description cannot be empty').optional(),
        amount: z.number().nonnegative('Amount must be a non-negative number').optional(),
        type: z.string().trim().min(1, 'Type cannot be empty').optional(),
        category: z.string().optional(),
        reference: z.string().optional()
    })
});

module.exports = {
    createTransactionSchema,
    updateTransactionSchema
};
