const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all recipes
 * @route   GET /api/recipes
 * @access  Private
 */
const getRecipes = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const recipes = await prisma.recipe.findMany({
        where: { tenantId },
        include: {
            ingredients: {
                include: {
                    inventoryItem: {
                        select: { name: true, unit: true, cost: true }
                    }
                }
            }
        }
    });
    res.json(recipes);
});

/**
 * @desc    Get a single recipe by ID
 * @route   GET /api/recipes/:id
 * @access  Private
 */
const getRecipeById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const recipe = await prisma.recipe.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
            ingredients: {
                include: {
                    inventoryItem: {
                        select: { name: true, unit: true, cost: true }
                    }
                }
            }
        }
    });
    
    if (!recipe) {
        res.status(404);
        throw new Error('Recipe not found');
    }
    res.json(recipe);
});

/**
 * @desc    Create a new recipe
 * @route   POST /api/recipes
 * @access  Private
 */
const createRecipe = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, notes, ingredients, type, batchWeight, batchSize } = req.body;

    const recipe = await prisma.recipe.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            name,
            notes,
            type: type || "layer",
            batchWeight: batchWeight !== undefined ? batchWeight : null,
            batchSize: batchSize !== undefined ? batchSize : null,
            ingredients: {
                create: (ingredients || []).map(ing => ({
                    inventoryItemId: ing.item,
                    quantity: ing.quantity
                }))
            }
        },
        include: {
            ingredients: true
        }
    });
    res.status(201).json(recipe);
});

/**
 * @desc    Update a recipe
 * @route   PUT /api/recipes/:id
 * @access  Private
 */
const updateRecipe = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, notes, ingredients, type, batchWeight, batchSize } = req.body;

    // Verify the recipe exists and belongs to the tenant
    const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
        res.status(404);
        throw new Error('Recipe not found');
    }

    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (batchWeight !== undefined) updateData.batchWeight = batchWeight;
    if (batchSize !== undefined) updateData.batchSize = batchSize;

    if (ingredients) {
        updateData.ingredients = {
            create: ingredients.map(ing => ({
                inventoryItemId: ing.item,
                quantity: ing.quantity
            }))
        };
    }

    // Update using a transaction to replace ingredients
    const updatedRecipe = await prisma.$transaction(async (tx) => {
        if (ingredients) {
            await tx.recipeIngredient.deleteMany({ where: { recipeId: req.params.id } });
        }
        return tx.recipe.update({
            where: { id: req.params.id },
            data: updateData,
            include: {
                ingredients: {
                    include: {
                        inventoryItem: { select: { name: true, unit: true, cost: true } }
                    }
                }
            }
        });
    });

    res.json(updatedRecipe);
});

/**
 * @desc    Delete a recipe
 * @route   DELETE /api/recipes/:id
 * @access  Private
 */
const deleteRecipe = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    
    const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
        res.status(404);
        throw new Error('Recipe not found');
    }

    await prisma.recipe.delete({ where: { id: req.params.id } });
    res.json({ message: 'Recipe removed successfully' });
});

module.exports = {
    getRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    deleteRecipe
};
