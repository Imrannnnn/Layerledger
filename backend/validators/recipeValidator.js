const { z } = require('zod');

const recipeIngredientSchema = z.object({
    item: z.string().min(1, 'Invalid inventory item ID in ingredients'),
    quantity: z.number().positive('Valid positive quantity is required for each ingredient')
});

const createRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name is required'),
        notes: z.string().optional().nullable(),
        ingredients: z.array(recipeIngredientSchema).optional().default([]),
        type: z.string().optional().default('layer'),
        batchWeight: z.number().optional().nullable(),
        batchSize: z.number().optional().nullable(),
        id: z.string().optional()
    })
});

const updateRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name cannot be empty').optional(),
        notes: z.string().optional().nullable(),
        ingredients: z.array(recipeIngredientSchema).optional(),
        type: z.string().optional(),
        batchWeight: z.number().optional().nullable(),
        batchSize: z.number().optional().nullable()
    })
});

module.exports = {
    createRecipeSchema,
    updateRecipeSchema
};
