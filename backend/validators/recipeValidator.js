const { z } = require('zod');

const recipeIngredientSchema = z.object({
    item: z.string().min(1, 'Invalid inventory item ID in ingredients'),
    quantity: z.coerce.number().positive('Valid positive quantity is required for each ingredient')
});

const sanitizeIngredients = (val) => {
    if (!Array.isArray(val)) return [];
    return val
        .filter(i => i && typeof i.item === 'string' && i.item.trim() !== '' && i.item !== 'item' && Number(i.quantity) > 0)
        .map(i => ({
            ...i,
            item: i.item.trim(),
            quantity: Number(i.quantity)
        }));
};

const createRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name is required'),
        notes: z.string().optional().nullable(),
        ingredients: z.preprocess(sanitizeIngredients, z.array(recipeIngredientSchema)).optional().default([]),
        type: z.string().optional().default('layer'),
        batchWeight: z.coerce.number().optional().nullable(),
        batchSize: z.coerce.number().optional().nullable(),
        application: z.string().optional().nullable(),
        fill_rate: z.coerce.number().optional().nullable(),
        fillRate: z.coerce.number().optional().nullable(),
        crumb_rate: z.coerce.number().optional().nullable(),
        crumbRate: z.coerce.number().optional().nullable(),
        cover_rate: z.coerce.number().optional().nullable(),
        coverRate: z.coerce.number().optional().nullable(),
        sheet_overhang_in: z.coerce.number().optional().nullable(),
        sheetOverhangIn: z.coerce.number().optional().nullable(),
        is_calibrated: z.boolean().optional(),
        isCalibrated: z.boolean().optional(),
        id: z.string().optional(),
        // Cake layer calibration fields
        calShape: z.string().optional().nullable(),
        cal_shape: z.string().optional().nullable(),
        calDimA: z.coerce.number().optional().nullable(),
        cal_dim_a: z.coerce.number().optional().nullable(),
        calDimB: z.coerce.number().optional().nullable(),
        cal_dim_b: z.coerce.number().optional().nullable(),
        calGrams: z.coerce.number().optional().nullable(),
        cal_grams: z.coerce.number().optional().nullable(),
        calHeightIn: z.coerce.number().optional().nullable(),
        cal_height_in: z.coerce.number().optional().nullable(),
        trimPct: z.coerce.number().optional().nullable(),
        trim_pct: z.coerce.number().optional().nullable(),
        density: z.coerce.number().optional().nullable(),
        // Covering fields
        canFill: z.boolean().optional().nullable(),
        can_fill: z.boolean().optional().nullable(),
        canCrumb: z.boolean().optional().nullable(),
        can_crumb: z.boolean().optional().nullable(),
        canFinish: z.boolean().optional().nullable(),
        can_finish: z.boolean().optional().nullable(),
        thickFillMm: z.coerce.number().optional().nullable(),
        thick_fill_mm: z.coerce.number().optional().nullable(),
        thickCrumbMm: z.coerce.number().optional().nullable(),
        thick_crumb_mm: z.coerce.number().optional().nullable(),
        thickFinishMm: z.coerce.number().optional().nullable(),
        thick_finish_mm: z.coerce.number().optional().nullable(),
        densityGPerCm3: z.coerce.number().optional().nullable(),
        density_g_cm3: z.coerce.number().optional().nullable(),
        wastePct: z.coerce.number().optional().nullable(),
        waste_pct: z.coerce.number().optional().nullable(),
        // Pastry fields
        sellMode: z.string().optional().nullable(),
        sell_mode: z.string().optional().nullable(),
        perBatch: z.coerce.number().optional().nullable(),
        per_batch: z.coerce.number().optional().nullable(),
        breakagePct: z.coerce.number().optional().nullable(),
        breakage_pct: z.coerce.number().optional().nullable()
    }).passthrough()
});

const updateRecipeSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Recipe name cannot be empty').optional(),
        notes: z.string().optional().nullable(),
        ingredients: z.preprocess(sanitizeIngredients, z.array(recipeIngredientSchema)).optional(),
        type: z.string().optional(),
        batchWeight: z.coerce.number().optional().nullable(),
        batchSize: z.coerce.number().optional().nullable(),
        application: z.string().optional().nullable(),
        fill_rate: z.coerce.number().optional().nullable(),
        fillRate: z.coerce.number().optional().nullable(),
        crumb_rate: z.coerce.number().optional().nullable(),
        crumbRate: z.coerce.number().optional().nullable(),
        cover_rate: z.coerce.number().optional().nullable(),
        coverRate: z.coerce.number().optional().nullable(),
        sheet_overhang_in: z.coerce.number().optional().nullable(),
        sheetOverhangIn: z.coerce.number().optional().nullable(),
        is_calibrated: z.boolean().optional(),
        isCalibrated: z.boolean().optional(),
        // Cake layer calibration fields
        calShape: z.string().optional().nullable(),
        cal_shape: z.string().optional().nullable(),
        calDimA: z.coerce.number().optional().nullable(),
        cal_dim_a: z.coerce.number().optional().nullable(),
        calDimB: z.coerce.number().optional().nullable(),
        cal_dim_b: z.coerce.number().optional().nullable(),
        calGrams: z.coerce.number().optional().nullable(),
        cal_grams: z.coerce.number().optional().nullable(),
        calHeightIn: z.coerce.number().optional().nullable(),
        cal_height_in: z.coerce.number().optional().nullable(),
        trimPct: z.coerce.number().optional().nullable(),
        trim_pct: z.coerce.number().optional().nullable(),
        density: z.coerce.number().optional().nullable(),
        // Covering fields
        canFill: z.boolean().optional().nullable(),
        can_fill: z.boolean().optional().nullable(),
        canCrumb: z.boolean().optional().nullable(),
        can_crumb: z.boolean().optional().nullable(),
        canFinish: z.boolean().optional().nullable(),
        can_finish: z.boolean().optional().nullable(),
        thickFillMm: z.coerce.number().optional().nullable(),
        thick_fill_mm: z.coerce.number().optional().nullable(),
        thickCrumbMm: z.coerce.number().optional().nullable(),
        thick_crumb_mm: z.coerce.number().optional().nullable(),
        thickFinishMm: z.coerce.number().optional().nullable(),
        thick_finish_mm: z.coerce.number().optional().nullable(),
        densityGPerCm3: z.coerce.number().optional().nullable(),
        density_g_cm3: z.coerce.number().optional().nullable(),
        wastePct: z.coerce.number().optional().nullable(),
        waste_pct: z.coerce.number().optional().nullable(),
        // Pastry fields
        sellMode: z.string().optional().nullable(),
        sell_mode: z.string().optional().nullable(),
        perBatch: z.coerce.number().optional().nullable(),
        per_batch: z.coerce.number().optional().nullable(),
        breakagePct: z.coerce.number().optional().nullable(),
        breakage_pct: z.coerce.number().optional().nullable()
    }).passthrough()
});

module.exports = {
    createRecipeSchema,
    updateRecipeSchema
};
