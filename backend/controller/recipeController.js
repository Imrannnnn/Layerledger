const prisma = require('../prisma');

/**
 * @desc    Get all recipes
 * @route   GET /api/recipes
 * @access  Private
 */
const getRecipes = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error in getRecipes:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a single recipe by ID
 * @route   GET /api/recipes/:id
 * @access  Private
 */
const getRecipeById = async (req, res) => {
    try {
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
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        console.error("Error in getRecipeById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new recipe
 * @route   POST /api/recipes
 * @access  Private
 */
const createRecipe = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, notes, ingredients } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Recipe name is required' });
        }
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            return res.status(400).json({ message: 'Ingredients list is required and must not be empty' });
        }

        // Validate ingredients items
        for (const ing of ingredients) {
            if (!ing.item || typeof ing.item !== 'string') {
                return res.status(400).json({ message: 'Invalid inventory item ID in ingredients' });
            }
            if (ing.quantity === undefined || typeof ing.quantity !== 'number' || ing.quantity <= 0) {
                return res.status(400).json({ message: 'Valid positive quantity is required for each ingredient' });
            }
        }

        const recipe = await prisma.recipe.create({
            data: {
                tenantId,
                name,
                notes,
                ingredients: {
                    create: ingredients.map(ing => ({
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
    } catch (error) {
        console.error("Error in createRecipe:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a recipe
 * @route   PUT /api/recipes/:id
 * @access  Private
 */
const updateRecipe = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, notes, ingredients } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            return res.status(400).json({ message: 'Recipe name cannot be empty' });
        }

        // Verify the recipe exists and belongs to the tenant
        const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, tenantId } });
        if (!existing) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        const updateData = { notes };
        if (name) updateData.name = name;

        if (ingredients) {
            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({ message: 'Ingredients list must not be empty' });
            }
            for (const ing of ingredients) {
                if (!ing.item || typeof ing.item !== 'string') {
                    return res.status(400).json({ message: 'Invalid inventory item ID in ingredients' });
                }
                if (ing.quantity === undefined || typeof ing.quantity !== 'number' || ing.quantity <= 0) {
                    return res.status(400).json({ message: 'Valid positive quantity is required for each ingredient' });
                }
            }
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
    } catch (error) {
        console.error("Error in updateRecipe:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a recipe
 * @route   DELETE /api/recipes/:id
 * @access  Private
 */
const deleteRecipe = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        
        const existing = await prisma.recipe.findFirst({ where: { id: req.params.id, tenantId } });
        if (!existing) {
            return res.status(404).json({ message: 'Recipe not found' });
        }

        await prisma.recipe.delete({ where: { id: req.params.id } });
        res.json({ message: 'Recipe removed successfully' });
    } catch (error) {
        console.error("Error in deleteRecipe:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    deleteRecipe
};
