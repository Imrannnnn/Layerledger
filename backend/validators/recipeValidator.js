const { z } = require('zod');

const recipeIngredientSchema = z.object({
    item: z.string().min(1, 'Invalid inventory item ID in ingredients'),
    quantity: z.number().positive('Valid positive quantity is required for each ingredient')
});

const createRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name is required'),
        notes: z.string().optional(),
        ingredients: z.array(recipeIngredientSchema).min(1, 'Ingredients list is required and must not be empty'),
        id: z.string().optional()
    })
});

const updateRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name cannot be empty').optional(),
        notes: z.string().optional(),
        ingredients: z.array(recipeIngredientSchema).min(1, 'Ingredients list must not be empty').optional()
    })
});

module.exports = {
    createRecipeSchema,
    updateRecipeSchema
};
