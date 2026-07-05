const { z } = require('zod');

const createExpenseSchema = z.object({
    body: z.object({
        amount: z.number().nonnegative('Valid non-negative amount is required'),
        category: z.string().trim().min(1, 'Category is required'),
        date: z.string().datetime().optional().or(z.date().optional()),
        description: z.string().optional(),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
        id: z.string().optional()
    })
});

const updateExpenseSchema = z.object({
    body: z.object({
        amount: z.number().nonnegative('Amount must be a non-negative number').optional(),
        category: z.string().trim().min(1, 'Category cannot be empty').optional(),
        date: z.string().datetime().optional().or(z.date().optional()),
        description: z.string().optional(),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal(''))
    })
});

module.exports = {
    createExpenseSchema,
    updateExpenseSchema
};
