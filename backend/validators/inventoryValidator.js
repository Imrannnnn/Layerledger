const { z } = require('zod');

const createInventorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Inventory item name is required'),
        category: z.string().trim().min(1, 'Category is required'),
        unit: z.string().trim().min(1, 'Unit is required'),
        cost: z.number().nonnegative('Valid non-negative cost is required'),
        stock: z.number().nonnegative('Stock must be a non-negative number').optional().default(0),
        minStock: z.number().nonnegative('Minimum stock must be a non-negative number').optional().default(0),
        id: z.string().optional()
    })
});

const updateInventorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name cannot be empty').optional(),
        category: z.string().trim().min(1, 'Category cannot be empty').optional(),
        unit: z.string().trim().min(1, 'Unit cannot be empty').optional(),
        cost: z.number().nonnegative('Cost must be a non-negative number').optional(),
        stock: z.number().nonnegative('Stock must be a non-negative number').optional(),
        minStock: z.number().nonnegative('Minimum stock must be a non-negative number').optional()
    })
});

module.exports = {
    createInventorySchema,
    updateInventorySchema
};
