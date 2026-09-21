const { z } = require('zod');

const dateSchema = z.string().datetime().optional()
    .or(z.date().optional())
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional());

const numField = z.union([
    z.number(),
    z.string().transform(v => (v === "" ? null : parseFloat(v)))
]).optional().nullable();

const createPurchaseSchema = z.object({
    body: z.object({
        date: dateSchema,
        supplier: z.string().optional().nullable(),
        amount: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, 'Valid non-negative amount is required'),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal('')).nullable(),
        notes: z.string().optional().nullable(),
        id: z.string().optional(),
        itemId: z.string().optional().nullable(),
        unitSize: numField,
        qty: numField,
        price: numField,
        total: numField,
        cpu: numField,
        stockAdded: numField
    })
});

const updatePurchaseSchema = z.object({
    body: z.object({
        date: dateSchema,
        supplier: z.string().optional().nullable(),
        amount: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Amount must be a non-negative number'),
        receiptUrl: z.string().url('Invalid URL').optional().or(z.literal('')).nullable(),
        notes: z.string().optional().nullable(),
        itemId: z.string().optional().nullable(),
        unitSize: numField,
        qty: numField,
        price: numField,
        total: numField,
        cpu: numField,
        stockAdded: numField
    })
});

module.exports = {
    createPurchaseSchema,
    updatePurchaseSchema
};
