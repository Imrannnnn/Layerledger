const { z } = require('zod');

const createPurchaseSchema = z.object({
    body: z.object({
        date: z.string().datetime().optional().or(z.date().optional()),
        supplier: z.string().optional(),
        amount: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, 'Valid non-negative amount is required'),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
        notes: z.string().optional(),
        id: z.string().optional()
    })
});

const updatePurchaseSchema = z.object({
    body: z.object({
        date: z.string().datetime().optional().or(z.date().optional()),
        supplier: z.string().optional(),
        amount: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Amount must be a non-negative number'),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
        notes: z.string().optional()
    })
});

module.exports = {
    createPurchaseSchema,
    updatePurchaseSchema
};
