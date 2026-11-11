require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(60000);

const prisma = require('../prisma');
const chartOfAccountsService = require('../modules/accounting/services/chartOfAccounts.service');
const { createRecipe } = require('../controller/recipeController');
const { createOrder, updateOrder } = require('../controller/orderController');
const { batchStockAdjustment, getInventory } = require('../controller/inventoryController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const callController = async (fn, req, res) => {
    return new Promise((resolve, reject) => {
        const next = (err) => {
            if (err) reject(err);
            else resolve();
        };
        fn(req, res, next)
            .then(() => resolve(res.json.mock.calls[0] ? res.json.mock.calls[0][0] : undefined))
            .catch(reject);
    });
};

describe('BakeWealth Calibration and Production Build Spec Integration Tests', () => {
    let tenantId;
    let vanillaRecipeId;
    let flourItemId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Calibration Bakery Test',
                type: 'individual',
                settings: {
                    monthlyOverhead: 899583,
                    annualProductionHours: 1800,
                    ordersPerMonth: 20
                }
            }
        });
        tenantId = tenant.id;
        await chartOfAccountsService.seedTenantChartOfAccounts(tenantId);

        const flour = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: 'All-Purpose Flour',
                category: 'Flour & Grain',
                unit: 'kg',
                cost: 1200,
                stock: 50,
                totalValueOnHand: 60000
            }
        });
        flourItemId = flour.id;
    });

    afterAll(async () => {
        if (tenantId) {
            await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    test('1. Recipe Calibration: 617g in 6 inch round levelled to 2 in derives density 10.911', async () => {
        const req = {
            user: { tenantId },
            body: {
                name: 'Vanilla Sponge Calibration',
                type: 'cake_layer',
                calShape: 'round',
                calDimA: 6,
                calGrams: 617,
                calHeightIn: 2,
                trimPct: 0.08,
                ingredients: [
                    { item: flourItemId, quantity: 300 }
                ]
            }
        };
        const res = mockRes();
        const created = await callController(createRecipe, req, res);

        expect(created.type).toBe('cake_layer');
        expect(created.isCalibrated).toBe(true);
        expect(created.density).toBeCloseTo(10.911, 3);
        expect(created.calShape).toBe('round');
        expect(created.calDimA).toBe(6);
        vanillaRecipeId = created.id;
    });

    test('2. Covering recipe: Job declarations and thicknesses', async () => {
        const req = {
            user: { tenantId },
            body: {
                name: 'Decorating Fondant',
                type: 'covering',
                canFill: false,
                canCrumb: false,
                canFinish: true,
                thickFinishMm: 8.0,
                densityGPerCm3: 1.35,
                wastePct: 0.25,
                ingredients: []
            }
        };
        const res = mockRes();
        const created = await callController(createRecipe, req, res);

        expect(created.type).toBe('covering');
        expect(created.canFill).toBe(false);
        expect(created.canCrumb).toBe(false);
        expect(created.canFinish).toBe(true);
        expect(created.thickFinishMm).toBe(8.0);
        expect(created.densityGPerCm3).toBe(1.35);
        expect(created.wastePct).toBe(0.25);
        expect(created.id).toBeDefined();
    });

    test('3. Confirming an order moves NO stock and commits ingredients to production', async () => {
        const req = {
            user: { tenantId },
            body: {
                status: 'confirmed',
                totalPrice: 50000,
                totalCost: 15000,
                metadata: {
                    productionSheet: {
                        shoppingList: [
                            { itemId: flourItemId, quantity: 10, neededGrams: 10 }
                        ]
                    }
                },
                items: [
                    { recipeId: vanillaRecipeId, name: 'Tier 1' }
                ],
                usages: [
                    { itemId: flourItemId, qty: 10 }
                ]
            }
        };
        const res = mockRes();
        const order = await callController(createOrder, req, res);
        expect(order.status).toBe('confirmed');
        expect(order.ingredientsDeducted).toBe(false);

        // Check inventory: On hand must still be 50, committed must be 10, free must be 40
        const invReq = { user: { tenantId }, query: {} };
        const invRes = mockRes();
        const invList = await callController(getInventory, invReq, invRes);
        const flour = invList.find(i => i.id === flourItemId);

        expect(flour.stock).toBe(50);
        expect(flour.onHand).toBe(50);
        expect(flour.committed).toBe(10);
        expect(flour.free).toBe(40);
    });

    test('4. Marking order delivered moves stock and clears committed stock', async () => {
        const confirmedOrders = await prisma.order.findMany({ where: { tenantId, status: 'confirmed' } });
        expect(confirmedOrders.length).toBeGreaterThan(0);
        const orderId = confirmedOrders[0].id;

        const req = {
            user: { tenantId },
            params: { id: orderId },
            body: {
                status: 'delivered',
                usages: [
                    { itemId: flourItemId, qty: 10 }
                ]
            }
        };
        const res = mockRes();
        const updated = await callController(updateOrder, req, res);
        expect(updated.status).toBe('delivered');
        expect(updated.ingredientsDeducted).toBe(true);

        // Check stock after delivery: On hand is now 40, committed is 0, free is 40
        const invReq = { user: { tenantId }, query: {} };
        const invRes = mockRes();
        const invList = await callController(getInventory, invReq, invRes);
        const flour = invList.find(i => i.id === flourItemId);

        expect(flour.stock).toBe(40);
        expect(flour.onHand).toBe(40);
        expect(flour.committed).toBe(0);
        expect(flour.free).toBe(40);
    });

    test('5. Delivery allows negative stock and flags it without blocking', async () => {
        const req = {
            user: { tenantId },
            body: {
                status: 'delivered',
                totalPrice: 80000,
                totalCost: 60000,
                usages: [
                    { itemId: flourItemId, qty: 50 } // On hand is 40, so new stock is -10
                ]
            }
        };
        const res = mockRes();
        const delivered = await callController(createOrder, req, res);
        expect(delivered.status).toBe('delivered');

        const flour = await prisma.inventoryItem.findUnique({ where: { id: flourItemId } });
        expect(flour.stock).toBe(-10);

        // Check movement history has [FLAGGED: NEGATIVE STOCK]
        const history = await prisma.inventoryHistory.findFirst({
            where: { tenantId, inventoryItemId: flourItemId, qtyDelta: -50 }
        });
        expect(history).toBeDefined();
        expect(history.reason).toContain('NEGATIVE STOCK');
    });

    test('6. Batch stock adjustment: Counted wrong (two-way) & Other (note required)', async () => {
        // Step A: Counted wrong increases stock from -10 back to 20 (delta = +30)
        const reqAdj = {
            user: { tenantId },
            body: {
                reason: 'Counted wrong',
                date: new Date().toISOString(),
                adjustments: [
                    { itemId: flourItemId, targetQty: 20 }
                ]
            }
        };
        const resAdj = mockRes();
        const result = await callController(batchStockAdjustment, reqAdj, resAdj);
        expect(result.success).toBe(true);

        let flour = await prisma.inventoryItem.findUnique({ where: { id: flourItemId } });
        expect(flour.stock).toBe(20);

        // Step B: Other without note fails with 400
        const reqInvalidOther = {
            user: { tenantId },
            body: {
                reason: 'Other',
                date: new Date().toISOString(),
                note: '',
                adjustments: [
                    { itemId: flourItemId, qtyDelta: -2 }
                ]
            }
        };
        await expect(callController(batchStockAdjustment, reqInvalidOther, mockRes())).rejects.toThrow(/note is required/);

        // Step C: Other with note succeeds
        const reqValidOther = {
            user: { tenantId },
            body: {
                reason: 'Other',
                date: new Date().toISOString(),
                note: 'Water pipe leak above storage bin',
                adjustments: [
                    { itemId: flourItemId, qtyDelta: -5 }
                ]
            }
        };
        const resValidOther = mockRes();
        const validResult = await callController(batchStockAdjustment, reqValidOther, resValidOther);
        expect(validResult.success).toBe(true);

        flour = await prisma.inventoryItem.findUnique({ where: { id: flourItemId } });
        expect(flour.stock).toBe(15);
    });
});
