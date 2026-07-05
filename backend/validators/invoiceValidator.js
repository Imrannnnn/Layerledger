const { z } = require('zod');

const createInvoiceSchema = z.object({
    body: z.object({
        orderId: z.string().trim().min(1, 'Order ID is required'),
        invoiceNumber: z.string().trim().min(1, 'Invoice number is required'),
        issueDate: z.string().datetime().optional().or(z.date().optional()),
        dueDate: z.string().datetime().optional().or(z.date().optional()),
        status: z.string().optional(),
        notes: z.string().optional(),
        id: z.string().optional()
    })
});

const updateInvoiceSchema = z.object({
    body: z.object({
        orderId: z.string().trim().min(1, 'Order ID cannot be empty').optional(),
        invoiceNumber: z.string().trim().min(1, 'Invoice number cannot be empty').optional(),
        issueDate: z.string().datetime().optional().or(z.date().optional()),
        dueDate: z.string().datetime().optional().or(z.date().optional()),
        status: z.string().optional(),
        notes: z.string().optional()
    })
});

module.exports = {
    createInvoiceSchema,
    updateInvoiceSchema
};
