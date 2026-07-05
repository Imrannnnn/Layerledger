const { z } = require('zod');

const createPackagingSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Packaging name is required'),
        price: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val) && val >= 0, 'Valid non-negative price is required'),
        stock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : 0).refine(val => !isNaN(val) && val >= 0, 'Stock must be a non-negative number'),
        minStock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : 0).refine(val => !isNaN(val) && val >= 0, 'Minimum stock must be a non-negative number')
    })
});

const updatePackagingSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Packaging name cannot be empty').optional(),
        price: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Price must be a non-negative number'),
        stock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Stock must be a non-negative number'),
        minStock: z.union([z.number(), z.string()]).optional().transform(val => val !== undefined ? parseFloat(val) : undefined).refine(val => val === undefined || (!isNaN(val) && val >= 0), 'Minimum stock must be a non-negative number')
    })
});

module.exports = {
    createPackagingSchema,
    updatePackagingSchema
};
