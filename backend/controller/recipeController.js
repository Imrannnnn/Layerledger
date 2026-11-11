const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { getEffectivePlan, PLAN_LIMITS } = require('./planController');
const { calculateDensity } = require('../lib/cakeGeometry');

/**
 * Normalize recipe type string to one of: 'cake_layer', 'covering', 'pastry'
 */
function normalizeRecipeType(rawType) {
    if (!rawType) return 'cake_layer';
    const lower = String(rawType).toLowerCase().trim();
    if (lower === 'layer' || lower === 'cake_layer' || lower === 'cake') return 'cake_layer';
    if (lower === 'covering' || lower === 'frosting' || lower === 'filling') return 'covering';
    if (lower === 'pastry' || lower === 'dessert') return 'pastry';
    return lower;
}

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
    const normType = normalizeRecipeType(type);

    const application = req.body.application !== undefined ? req.body.application : "spread";
    const fillRate = req.body.fillRate !== undefined ? req.body.fillRate : (req.body.fill_rate !== undefined ? req.body.fill_rate : null);
    const crumbRate = req.body.crumbRate !== undefined ? req.body.crumbRate : (req.body.crumb_rate !== undefined ? req.body.crumb_rate : 0);
    const coverRate = req.body.coverRate !== undefined ? req.body.coverRate : (req.body.cover_rate !== undefined ? req.body.cover_rate : null);
    const sheetOverhangIn = req.body.sheetOverhangIn !== undefined ? req.body.sheetOverhangIn : (req.body.sheet_overhang_in !== undefined ? req.body.sheet_overhang_in : null);

    // Cake layer calibration fields
    const calShape = req.body.calShape || req.body.cal_shape || null;
    const calDimA = req.body.calDimA !== undefined ? Number(req.body.calDimA) : (req.body.cal_dim_a !== undefined ? Number(req.body.cal_dim_a) : null);
    const calDimB = req.body.calDimB !== undefined ? Number(req.body.calDimB) : (req.body.cal_dim_b !== undefined ? Number(req.body.cal_dim_b) : null);
    const calGrams = req.body.calGrams !== undefined ? Number(req.body.calGrams) : (req.body.cal_grams !== undefined ? Number(req.body.cal_grams) : null);
    const calHeightIn = req.body.calHeightIn !== undefined ? Number(req.body.calHeightIn) : (req.body.cal_height_in !== undefined ? Number(req.body.cal_height_in) : null);
    const trimPct = req.body.trimPct !== undefined ? Number(req.body.trimPct) : (req.body.trim_pct !== undefined ? Number(req.body.trim_pct) : 0.08);

    let density = req.body.density !== undefined ? Number(req.body.density) : null;
    let isCalibrated = req.body.isCalibrated !== undefined ? !!req.body.isCalibrated : (req.body.is_calibrated !== undefined ? !!req.body.is_calibrated : false);

    if (calGrams && calShape && calDimA && calHeightIn) {
        density = calculateDensity(calGrams, calShape, calDimA, calDimB, calHeightIn);
        isCalibrated = true;
    }

    // Covering fields
    const canFill = req.body.canFill !== undefined ? !!req.body.canFill : (req.body.can_fill !== undefined ? !!req.body.can_fill : true);
    const canCrumb = req.body.canCrumb !== undefined ? !!req.body.canCrumb : (req.body.can_crumb !== undefined ? !!req.body.can_crumb : true);
    const canFinish = req.body.canFinish !== undefined ? !!req.body.canFinish : (req.body.can_finish !== undefined ? !!req.body.can_finish : true);
    const thickFillMm = req.body.thickFillMm !== undefined ? Number(req.body.thickFillMm) : (req.body.thick_fill_mm !== undefined ? Number(req.body.thick_fill_mm) : null);
    const thickCrumbMm = req.body.thickCrumbMm !== undefined ? Number(req.body.thickCrumbMm) : (req.body.thick_crumb_mm !== undefined ? Number(req.body.thick_crumb_mm) : null);
    const thickFinishMm = req.body.thickFinishMm !== undefined ? Number(req.body.thickFinishMm) : (req.body.thick_finish_mm !== undefined ? Number(req.body.thick_finish_mm) : null);
    const densityGPerCm3 = req.body.densityGPerCm3 !== undefined ? Number(req.body.densityGPerCm3) : (req.body.density_g_cm3 !== undefined ? Number(req.body.density_g_cm3) : null);
    const wastePct = req.body.wastePct !== undefined ? Number(req.body.wastePct) : (req.body.waste_pct !== undefined ? Number(req.body.waste_pct) : null);

    // Pastry fields
    const sellMode = req.body.sellMode || req.body.sell_mode || null;
    const perBatch = req.body.perBatch !== undefined ? Number(req.body.perBatch) : (req.body.per_batch !== undefined ? Number(req.body.per_batch) : null);
    const breakagePct = req.body.breakagePct !== undefined ? Number(req.body.breakagePct) : (req.body.breakage_pct !== undefined ? Number(req.body.breakage_pct) : null);

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
            type: normType,
            batchWeight: batchWeight !== undefined ? batchWeight : null,
            batchSize: batchSize !== undefined ? batchSize : null,
            application,
            fillRate,
            crumbRate,
            coverRate,
            sheetOverhangIn,
            isCalibrated,
            calShape,
            calDimA,
            calDimB,
            calGrams,
            calHeightIn,
            trimPct,
            density,
            canFill,
            canCrumb,
            canFinish,
            thickFillMm,
            thickCrumbMm,
            thickFinishMm,
            densityGPerCm3,
            wastePct,
            sellMode,
            perBatch,
            breakagePct,
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
    if (type !== undefined) updateData.type = normalizeRecipeType(type);
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

    // Calibration fields
    if (req.body.calShape !== undefined || req.body.cal_shape !== undefined) {
        updateData.calShape = req.body.calShape || req.body.cal_shape || null;
    }
    if (req.body.calDimA !== undefined || req.body.cal_dim_a !== undefined) {
        updateData.calDimA = req.body.calDimA !== undefined ? Number(req.body.calDimA) : Number(req.body.cal_dim_a);
    }
    if (req.body.calDimB !== undefined || req.body.cal_dim_b !== undefined) {
        updateData.calDimB = req.body.calDimB !== undefined ? Number(req.body.calDimB) : (req.body.cal_dim_b ? Number(req.body.cal_dim_b) : null);
    }
    if (req.body.calGrams !== undefined || req.body.cal_grams !== undefined) {
        updateData.calGrams = req.body.calGrams !== undefined ? Number(req.body.calGrams) : Number(req.body.cal_grams);
    }
    if (req.body.calHeightIn !== undefined || req.body.cal_height_in !== undefined) {
        updateData.calHeightIn = req.body.calHeightIn !== undefined ? Number(req.body.calHeightIn) : Number(req.body.cal_height_in);
    }
    if (req.body.trimPct !== undefined || req.body.trim_pct !== undefined) {
        updateData.trimPct = req.body.trimPct !== undefined ? Number(req.body.trimPct) : Number(req.body.trim_pct);
    }

    const curShape = updateData.calShape !== undefined ? updateData.calShape : existing.calShape;
    const curDimA = updateData.calDimA !== undefined ? updateData.calDimA : existing.calDimA;
    const curDimB = updateData.calDimB !== undefined ? updateData.calDimB : existing.calDimB;
    const curGrams = updateData.calGrams !== undefined ? updateData.calGrams : existing.calGrams;
    const curHeight = updateData.calHeightIn !== undefined ? updateData.calHeightIn : existing.calHeightIn;

    if (req.body.density !== undefined) {
        updateData.density = Number(req.body.density);
    } else if (curGrams && curShape && curDimA && curHeight) {
        updateData.density = calculateDensity(curGrams, curShape, curDimA, curDimB, curHeight);
        updateData.isCalibrated = true;
    }

    if (req.body.isCalibrated !== undefined) updateData.isCalibrated = !!req.body.isCalibrated;
    else if (req.body.is_calibrated !== undefined) updateData.isCalibrated = !!req.body.is_calibrated;

    // Covering fields
    if (req.body.canFill !== undefined || req.body.can_fill !== undefined) {
        updateData.canFill = req.body.canFill !== undefined ? !!req.body.canFill : !!req.body.can_fill;
    }
    if (req.body.canCrumb !== undefined || req.body.can_crumb !== undefined) {
        updateData.canCrumb = req.body.canCrumb !== undefined ? !!req.body.canCrumb : !!req.body.can_crumb;
    }
    if (req.body.canFinish !== undefined || req.body.can_finish !== undefined) {
        updateData.canFinish = req.body.canFinish !== undefined ? !!req.body.canFinish : !!req.body.can_finish;
    }
    if (req.body.thickFillMm !== undefined || req.body.thick_fill_mm !== undefined) {
        updateData.thickFillMm = req.body.thickFillMm !== undefined ? Number(req.body.thickFillMm) : Number(req.body.thick_fill_mm);
    }
    if (req.body.thickCrumbMm !== undefined || req.body.thick_crumb_mm !== undefined) {
        updateData.thickCrumbMm = req.body.thickCrumbMm !== undefined ? Number(req.body.thickCrumbMm) : Number(req.body.thick_crumb_mm);
    }
    if (req.body.thickFinishMm !== undefined || req.body.thick_finish_mm !== undefined) {
        updateData.thickFinishMm = req.body.thickFinishMm !== undefined ? Number(req.body.thickFinishMm) : Number(req.body.thick_finish_mm);
    }
    if (req.body.densityGPerCm3 !== undefined || req.body.density_g_cm3 !== undefined) {
        updateData.densityGPerCm3 = req.body.densityGPerCm3 !== undefined ? Number(req.body.densityGPerCm3) : Number(req.body.density_g_cm3);
    }
    if (req.body.wastePct !== undefined || req.body.waste_pct !== undefined) {
        updateData.wastePct = req.body.wastePct !== undefined ? Number(req.body.wastePct) : Number(req.body.waste_pct);
    }

    // Pastry fields
    if (req.body.sellMode !== undefined || req.body.sell_mode !== undefined) {
        updateData.sellMode = req.body.sellMode || req.body.sell_mode;
    }
    if (req.body.perBatch !== undefined || req.body.per_batch !== undefined) {
        updateData.perBatch = req.body.perBatch !== undefined ? Number(req.body.perBatch) : Number(req.body.per_batch);
    }
    if (req.body.breakagePct !== undefined || req.body.breakage_pct !== undefined) {
        updateData.breakagePct = req.body.breakagePct !== undefined ? Number(req.body.breakagePct) : Number(req.body.breakage_pct);
    }

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
        const [, resRecipe] = await prisma.$transaction([
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
