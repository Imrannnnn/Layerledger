require('dotenv').config();
jest.setTimeout(30000);
const prisma = require('../prisma');
const { createItem, adjustItem } = require('../controller/inventoryController');
const { createPurchase } = require('../controller/purchaseController');
const { createOrder } = require('../controller/orderController');

// Helper to call controllers wrapped in asyncHandler and return a Promise
const callController = (controllerFn, req, res) => {
    return new Promise((resolve, reject) => {
        // Mock res.status to return res (for chaining)
        res.status = jest.fn().mockImplementation(() => res);

        // Mock res.json to resolve the promise with the response data
        res.json = jest.fn().mockImplementation((data) => {
            resolve(data);
            return res;
        });

        // Call the controller, passing a next function that rejects on error
        controllerFn(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
};

const mockRes = () => {
    const res = {};
    return res;
};

describe('Weighted Average Cost (WAVCO) Inventory Valuation Integration Tests', () => {
    let tenantId;
    let itemId;

    beforeAll(async () => {
        // Create a temporary tenant and user for testing
        const tenant = await prisma.tenant.create({
            data: {
                name: `WAVCO Test Tenant ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantId = tenant.id;

        await prisma.user.create({
            data: {
                tenantId,
                name: 'Test Baker',
                email: `test_baker_${Date.now()}@example.com`,
                passwordHash: 'dummyhash',
                role: 'owner'
            }
        });
    });

    afterAll(async () => {
        // Cascade delete the temporary tenant and all test records
        if (tenantId) {
            await prisma.tenant.delete({
                where: { id: tenantId }
            });
        }
    });

    test('Rule 3 — Opening Balance seeding & audit logging', async () => {
        const req = {
            user: { tenantId },
            body: {
                name: 'Flour',
                category: 'Baking',
                unit: 'kg',
                cost: 1000,
                stock: 10,
                minStock: 5
            }
        };
        const res = mockRes();

        const testItem = await callController(createItem, req, res);
        itemId = testItem.id;

        expect(res.status).toHaveBeenCalledWith(201);
        expect(testItem.stock).toBe(10);
        expect(testItem.totalValueOnHand).toBe(10000);
        expect(testItem.cost).toBe(1000);

        // Verify history log
        const history = await prisma.inventoryHistory.findFirst({
            where: { inventoryItemId: itemId, tenantId, type: 'OPENING_BALANCE' }
        });
        expect(history).toBeDefined();
        expect(history.qtyDelta).toBe(10);
        expect(history.valueDelta).toBe(10000);
        expect(history.pricePerUnit).toBe(1000);
        expect(history.qtyAfter).toBe(10);
        expect(history.valueAfter).toBe(10000);
        expect(history.avgCostAfter).toBe(1000);
    });

    test('Rule 1 — Recalculating averages when stock is PURCHASED', async () => {
        // Worked Example step 2: Buy 5 kg @ ₦1,200 (Stock total = 15, value = 16,000, avg = 1,066.67)
        const reqPur1 = {
            user: { tenantId },
            body: {
                supplier: 'Millers Corp',
                amount: 6000,
                notes: 'Buy 5 kg at 1200',
                itemId,
                unitSize: 1,
                qty: 5,
                price: 1200,
                total: 6000,
                cpu: 1200,
                stockAdded: 5
            }
        };
        const resPur1 = mockRes();

        await callController(createPurchase, reqPur1, resPur1);
        expect(resPur1.status).toHaveBeenCalledWith(201);

        let item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
        expect(item.stock).toBe(15);
        expect(item.totalValueOnHand).toBe(16000);
        expect(item.cost).toBeCloseTo(1066.67, 2);

        // Worked Example step 3: Buy 10 kg @ ₦1,400 (Stock total = 25, value = 30,000, avg = 1,200)
        const reqPur2 = {
            user: { tenantId },
            body: {
                supplier: 'Baker Depot',
                amount: 14000,
                notes: 'Buy 10 kg at 1400',
                itemId,
                unitSize: 1,
                qty: 10,
                price: 1400,
                total: 14000,
                cpu: 1400,
                stockAdded: 10
            }
        };
        const resPur2 = mockRes();

        await callController(createPurchase, reqPur2, resPur2);
        expect(resPur2.status).toHaveBeenCalledWith(201);

        item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
        expect(item.stock).toBe(25);
        expect(item.totalValueOnHand).toBe(30000);
        expect(item.cost).toBe(1200);

        // Verify history log contains the PURCHASE entries
        const purHistory = await prisma.inventoryHistory.findMany({
            where: { inventoryItemId: itemId, tenantId, type: 'PURCHASE' },
            orderBy: { date: 'asc' }
        });
        expect(purHistory.length).toBe(2);
        expect(purHistory[0].qtyDelta).toBe(5);
        expect(purHistory[0].valueDelta).toBe(6000);
        expect(purHistory[1].qtyDelta).toBe(10);
        expect(purHistory[1].valueDelta).toBe(14000);
    });

    test('Rule 2 — Deducting from both totals using CURRENT average cost during USE', async () => {
        // Worked Example step 4: Use 4 kg (Stock total = 21, value = 25,200, avg = 1,200)
        const reqOrder = {
            user: { tenantId },
            body: {
                status: 'confirmed',
                totalPrice: 15000,
                totalCost: 4800,
                usages: [
                    { itemId, qty: 4 }
                ]
            }
        };
        const resOrder = mockRes();

        await callController(createOrder, reqOrder, resOrder);
        expect(resOrder.status).toHaveBeenCalledWith(201);

        const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
        expect(item.stock).toBe(21);
        expect(item.totalValueOnHand).toBe(25200);
        expect(item.cost).toBe(1200);

        // Verify history log has the USAGE entry
        const usageHistory = await prisma.inventoryHistory.findFirst({
            where: { inventoryItemId: itemId, tenantId, type: 'USAGE' }
        });
        expect(usageHistory).toBeDefined();
        expect(usageHistory.qtyDelta).toBe(-4);
        expect(usageHistory.valueDelta).toBe(-4800);
        expect(usageHistory.pricePerUnit).toBe(1200);
        expect(usageHistory.qtyAfter).toBe(21);
        expect(usageHistory.valueAfter).toBe(25200);
    });

    test('Rule 3 — Prevent negative stock', async () => {
        // Try to confirm an order using 30 kg (we only have 21 kg)
        const reqOrder = {
            user: { tenantId },
            body: {
                status: 'confirmed',
                totalPrice: 20000,
                totalCost: 36000,
                usages: [
                    { itemId, qty: 30 }
                ]
            }
        };
        const resOrder = mockRes();

        await expect(callController(createOrder, reqOrder, resOrder)).rejects.toThrow(/Insufficient stock/);
    });

    test('Rule 3 — Stock reaches 0 sets value to 0, preserves average cost', async () => {
        // Use exactly the remaining 21 kg
        const reqOrder = {
            user: { tenantId },
            body: {
                status: 'confirmed',
                totalPrice: 30000,
                totalCost: 25200,
                usages: [
                    { itemId, qty: 21 }
                ]
            }
        };
        const resOrder = mockRes();

        await callController(createOrder, reqOrder, resOrder);
        expect(resOrder.status).toHaveBeenCalledWith(201);

        const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
        expect(item.stock).toBe(0);
        expect(item.totalValueOnHand).toBe(0);
        expect(item.cost).toBe(1200);
    });

    test('Rule 3 — Manual Adjustment entry', async () => {
        // Add manual cost correction / revaluation (revalue stock at 1500)
        // First restock some so we can revalue (add 10 kg @ 1200 -> stock=10, value=12000, cost=1200)
        const reqPur = {
            user: { tenantId },
            body: {
                supplier: 'Re-stock',
                amount: 12000,
                itemId,
                unitSize: 1,
                qty: 10,
                price: 1200,
                total: 12000,
                cpu: 1200,
                stockAdded: 10
            }
        };
        await callController(createPurchase, reqPur, mockRes());

        // Revalue at ₦1,500/kg
        const reqAdjust = {
            user: { tenantId },
            params: { id: itemId },
            body: {
                type: 'revaluation',
                newCost: 1500,
                reason: 'Market price spike'
            }
        };
        const resAdjust = mockRes();

        await callController(adjustItem, reqAdjust, resAdjust);

        const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
        expect(item.stock).toBe(10);
        expect(item.totalValueOnHand).toBe(15000);
        expect(item.cost).toBe(1500);

        // Verify history log has ADJUSTMENT revaluation
        const adjHistory = await prisma.inventoryHistory.findFirst({
            where: { inventoryItemId: itemId, tenantId, type: 'ADJUSTMENT' }
        });
        expect(adjHistory).toBeDefined();
        expect(adjHistory.qtyDelta).toBe(0);
        expect(adjHistory.valueDelta).toBe(3000);
        expect(adjHistory.avgCostAfter).toBe(1500);
    });
});
