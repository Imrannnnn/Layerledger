require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(30000);
const prisma = require('../prisma');
const { createRecipe, updateRecipe } = require('../controller/recipeController');
const { createRecipeSchema, updateRecipeSchema } = require('../validators/recipeValidator');

const callController = (controllerFn, req, res) => {
    return new Promise((resolve, reject) => {
        res.status = jest.fn().mockImplementation(() => res);
        res.json = jest.fn().mockImplementation((data) => {
            resolve(data);
            return res;
        });
        controllerFn(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

describe('Recipe Controller & Validation Resilience Tests', () => {
    let tenantId;
    let validInventoryItemId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: `Recipe Test Tenant ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantId = tenant.id;

        const inv = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: `Flour ${Date.now()}`,
                category: 'Dry Goods',
                unit: 'kg',
                cost: 1000,
                stock: 20
            }
        });
        validInventoryItemId = inv.id;
    });

    afterAll(async () => {
        try {
            if (tenantId) {
                await prisma.recipeIngredient.deleteMany({
                    where: { recipe: { tenantId } }
                });
                await prisma.recipe.deleteMany({ where: { tenantId } });
                await prisma.inventoryItem.deleteMany({ where: { tenantId } });
                await prisma.tenant.delete({ where: { id: tenantId } });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        } finally {
            await prisma.$disconnect();
        }
    });

    test('createRecipeSchema sanitizes empty / zero-quantity / placeholder ingredient rows', () => {
        const bodyWithPlaceholders = {
            name: 'Red Velvet',
            ingredients: [
                { item: 'item', quantity: 0 },
                { item: '', quantity: 0 },
                { item: '   ', quantity: 5 },
                { item: 'valid_id', quantity: 2.5 }
            ]
        };

        const result = createRecipeSchema.safeParse({ body: bodyWithPlaceholders });
        expect(result.success).toBe(true);
        expect(result.data.body.ingredients).toEqual([
            { item: 'valid_id', quantity: 2.5 }
        ]);
    });

    test('createRecipe successfully creates recipe with empty ingredients array', async () => {
        const req = {
            user: { tenantId },
            body: {
                name: 'Vanilla Sponge',
                notes: 'Imported recipe',
                ingredients: []
            }
        };
        const res = {};
        const recipe = await callController(createRecipe, req, res);

        expect(recipe).toBeDefined();
        expect(recipe.name).toBe('Vanilla Sponge');
        expect(recipe.ingredients).toEqual([]);
    });

    test('createRecipe creates recipe and filters out non-existent inventory items safely without crash', async () => {
        const req = {
            user: { tenantId },
            body: {
                name: 'Chocolate Layer Cake',
                notes: 'Rich chocolate',
                ingredients: [
                    { item: validInventoryItemId, quantity: 1.5 },
                    { item: 'non-existent-item-id-12345', quantity: 3 }
                ]
            }
        };
        const res = {};
        const recipe = await callController(createRecipe, req, res);

        expect(recipe).toBeDefined();
        expect(recipe.name).toBe('Chocolate Layer Cake');
        expect(recipe.ingredients.length).toBe(1);
        expect(recipe.ingredients[0].inventoryItemId).toBe(validInventoryItemId);
        expect(recipe.ingredients[0].quantity).toBe(1.5);
    });

    test('updateRecipe safely updates ingredients without foreign key crash', async () => {
        // Create base recipe
        const created = await prisma.recipe.create({
            data: {
                tenantId,
                name: 'Base Recipe For Update',
                type: 'layer'
            }
        });

        const req = {
            user: { tenantId },
            params: { id: created.id },
            body: {
                name: 'Updated Recipe Name',
                ingredients: [
                    { item: validInventoryItemId, quantity: 4 },
                    { item: 'bogus-id-999', quantity: 2 }
                ]
            }
        };
        const res = {};
        const updated = await callController(updateRecipe, req, res);

        expect(updated).toBeDefined();
        expect(updated.name).toBe('Updated Recipe Name');
        expect(updated.ingredients.length).toBe(1);
        expect(updated.ingredients[0].inventoryItemId).toBe(validInventoryItemId);
        expect(updated.ingredients[0].quantity).toBe(4);
    });

    test('updateRecipeSchema does not strip calibration fields and updateRecipe persists calibration', async () => {
        const created = await prisma.recipe.create({
            data: {
                tenantId,
                name: 'Uncalibrated Sponge',
                type: 'layer'
            }
        });

        const rawBody = {
            name: 'Calibrated Sponge',
            calGrams: 500,
            calShape: 'round',
            calDimA: 6,
            calHeightIn: 2,
            trimPct: 8
        };

        const parseResult = updateRecipeSchema.safeParse({ body: rawBody });
        expect(parseResult.success).toBe(true);
        expect(parseResult.data.body.calGrams).toBe(500);
        expect(parseResult.data.body.calShape).toBe('round');
        expect(parseResult.data.body.calDimA).toBe(6);
        expect(parseResult.data.body.calHeightIn).toBe(2);

        const req = {
            user: { tenantId },
            params: { id: created.id },
            body: parseResult.data.body
        };
        const res = {};
        const updated = await callController(updateRecipe, req, res);

        expect(updated).toBeDefined();
        expect(updated.calGrams).toBe(500);
        expect(updated.calShape).toBe('round');
        expect(updated.isCalibrated).toBe(true);
        expect(updated.density).toBeGreaterThan(0);
        expect(updated.trimPct).toBe(0.08);

        // Fetch back directly from database to verify persistence
        const fromDb = await prisma.recipe.findUnique({ where: { id: created.id } });
        expect(fromDb.calGrams).toBe(500);
        expect(fromDb.isCalibrated).toBe(true);
        expect(fromDb.density).toBeGreaterThan(0);
    });
});
