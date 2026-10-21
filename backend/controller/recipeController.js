const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { getEffectivePlan, PLAN_LIMITS } = require('./planController');

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
    const application = req.body.application !== undefined ? req.body.application : "spread";
    const fillRate = req.body.fillRate !== undefined ? req.body.fillRate : (req.body.fill_rate !== undefined ? req.body.fill_rate : null);
    const crumbRate = req.body.crumbRate !== undefined ? req.body.crumbRate : (req.body.crumb_rate !== undefined ? req.body.crumb_rate : 0);
    const coverRate = req.body.coverRate !== undefined ? req.body.coverRate : (req.body.cover_rate !== undefined ? req.body.cover_rate : null);
    const sheetOverhangIn = req.body.sheetOverhangIn !== undefined ? req.body.sheetOverhangIn : (req.body.sheet_overhang_in !== undefined ? req.body.sheet_overhang_in : null);
    const isCalibrated = req.body.isCalibrated !== undefined ? !!req.body.isCalibrated : (req.body.is_calibrated !== undefined ? !!req.body.is_calibrated : false);

    // Enforce Recipe limits based on plan
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true }
    });
    const effective = getEffectivePlan(tenant);
    const planLimits = PLAN_LIMITS[effective.plan] || PLAN_LIMITS.free;

    if (planLimits.recipes !== Infinity) {
        const currentCount = await prisma.recipe.count({ where: { tenantId } });
        if (currentCount >= planLimits.recipes) {
            res.status(403);
            const err = new Error(`Recipe limit reached (${planLimits.recipes} recipes for ${planLimits.name} plan). Upgrade to ${effective.plan === 'free' ? 'Standard (60 recipes)' : 'Premium (unlimited recipes)'}.`);
            err.code = 'PLAN_LIMIT_REACHED';
            err.limitType = 'recipes';
            err.currentCount = currentCount;
            err.limit = planLimits.recipes;
            err.plan = effective.plan;
            err.upgradePlan = effective.plan === 'free' ? 'standard' : 'premium';
            err.upgradePrice = effective.plan === 'free' ? 5000 : 10000;
            throw err;
        }
    }

    // Filter ingredients to only those that exist for this tenant
    let validIngredients = [];
    if (ingredients && ingredients.length > 0) {
        const itemIds = ingredients.map(ing => ing.item).filter(Boolean);
        if (itemIds.length > 0) {
            const existingItems = await prisma.inventoryItem.findMany({
                where: { id: { in: itemIds }, tenantId },
                select: { id: true }
            });
            const existingSet = new Set(existingItems.map(item => item.id));
            validIngredients = ingredients.filter(ing => existingSet.has(ing.item));
        }
    }

    const recipe = await prisma.recipe.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            name,
            notes,
            type: type || "layer",
            batchWeight: batchWeight !== undefined ? batchWeight : null,
            batchSize: batchSize !== undefined ? batchSize : null,
            application,
            fillRate,
            crumbRate,
            coverRate,
            sheetOverhangIn,
            isCalibrated,
            ingredients: {
                create: validIngredients.map(ing => ({
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
    if (req.body.application !== undefined) updateData.application = req.body.application;
    if (req.body.fillRate !== undefined) updateData.fillRate = req.body.fillRate;
    else if (req.body.fill_rate !== undefined) updateData.fillRate = req.body.fill_rate;
    if (req.body.crumbRate !== undefined) updateData.crumbRate = req.body.crumbRate;
    else if (req.body.crumb_rate !== undefined) updateData.crumbRate = req.body.crumb_rate;
    if (req.body.coverRate !== undefined) updateData.coverRate = req.body.coverRate;
    else if (req.body.cover_rate !== undefined) updateData.coverRate = req.body.cover_rate;
    if (req.body.sheetOverhangIn !== undefined) updateData.sheetOverhangIn = req.body.sheetOverhangIn;
    else if (req.body.sheet_overhang_in !== undefined) updateData.sheetOverhangIn = req.body.sheet_overhang_in;
    if (req.body.isCalibrated !== undefined) updateData.isCalibrated = !!req.body.isCalibrated;
    else if (req.body.is_calibrated !== undefined) updateData.isCalibrated = !!req.body.is_calibrated;

    if (ingredients) {
        const itemIds = ingredients.map(ing => ing.item).filter(Boolean);
        let validIngredients = [];
        if (itemIds.length > 0) {
            const existingItems = await prisma.inventoryItem.findMany({
                where: { id: { in: itemIds }, tenantId },
                select: { id: true }
            });
            const existingSet = new Set(existingItems.map(item => item.id));
            validIngredients = ingredients.filter(ing => existingSet.has(ing.item));
        }
        updateData.ingredients = {
            create: validIngredients.map(ing => ({
                inventoryItemId: ing.item,
                quantity: ing.quantity
            }))
        };
    }

    let updatedRecipe;
    if (ingredients) {
        const [_, resRecipe] = await prisma.$transaction([
            prisma.recipeIngredient.deleteMany({ where: { recipeId: req.params.id } }),
            prisma.recipe.update({
                where: { id: req.params.id },
                data: updateData,
                include: {
                    ingredients: {
                        include: {
                            inventoryItem: { select: { name: true, unit: true, cost: true } }
                        }
                    }
                }
            })
        ]);
        updatedRecipe = resRecipe;
    } else {
        updatedRecipe = await prisma.recipe.update({
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
    }

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
