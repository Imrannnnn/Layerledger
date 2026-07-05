const { z } = require('zod');

const orderItemSchema = z.object({
    recipeId: z.string().optional(),
    name: z.string().trim().min(1, 'Each item must have a name'),
    size: z.string().optional(),
    shape: z.string().optional(),
    layers: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? Number(val) : undefined),
    decorations: z.any().optional(),
    flavorExtras: z.any().optional(),
    price: z.number().nonnegative('Item price must be a non-negative number').optional().default(0),
    cost: z.number().nonnegative('Item cost must be a non-negative number').optional().default(0)
});

const orderPaymentSchema = z.object({
    amount: z.number().nonnegative('Payment amount must be a non-negative number'),
    date: z.string().datetime().optional().or(z.date().optional()),
    method: z.string().optional(),
    type: z.string().optional()
});

const createOrderSchema = z.object({
    body: z.object({
        clientId: z.string().optional(),
        status: z.string().optional(),
        dueDate: z.string().datetime().optional().or(z.date().optional()),
        items: z.array(orderItemSchema).optional(),
        totalPrice: z.number().nonnegative('Total price must be a non-negative number').optional().default(0),
        totalCost: z.number().nonnegative('Total cost must be a non-negative number').optional().default(0),
        payments: z.array(orderPaymentSchema).optional(),
        notes: z.string().optional(),
        id: z.string().optional()
    })
});

const updateOrderSchema = z.object({
    body: z.object({
        clientId: z.string().optional(),
        status: z.string().optional(),
        dueDate: z.string().datetime().optional().or(z.date().optional()).nullable(),
        items: z.array(orderItemSchema).optional(),
        totalPrice: z.number().nonnegative('Total price must be a non-negative number').optional(),
        totalCost: z.number().nonnegative('Total cost must be a non-negative number').optional(),
        payments: z.array(orderPaymentSchema).optional(),
        notes: z.string().optional()
    })
});

module.exports = {
    createOrderSchema,
    updateOrderSchema
};
