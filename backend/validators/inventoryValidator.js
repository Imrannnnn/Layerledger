const { z } = require('zod');

const createInventorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Inventory item name is required'),
        category: z.string().trim().min(1, 'Category is required'),
        unit: z.string().trim().min(1, 'Unit is required'),
        cost: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, 'Valid non-negative cost is required'),
        stock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : 0).refine(val => !isNaN(val) && val >= 0, 'Stock must be a non-negative number'),
        minStock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : 0).refine(val => !isNaN(val) && val >= 0, 'Minimum stock must be a non-negative number'),
        id: z.string().optional()
    })
});

const updateInventorySchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name cannot be empty').optional(),
        category: z.string().trim().min(1, 'Category cannot be empty').optional(),
        unit: z.string().trim().min(1, 'Unit cannot be empty').optional(),
        cost: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Cost must be a non-negative number'),
        stock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Stock must be a non-negative number'),
        minStock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Minimum stock must be a non-negative number')
    })
});

module.exports = {
    createInventorySchema,
    updateInventorySchema
};
