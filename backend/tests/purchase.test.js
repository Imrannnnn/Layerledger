require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(30000);
const prisma = require('../prisma');
const { createPurchase, updatePurchase } = require('../controller/purchaseController');

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

const mockRes = () => ({});

describe('Purchase Update & Inventory Synchronization Integration Tests', () => {
    let tenantId;
    let itemFlourId;
    let itemSugarId;

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: `Purchase Test Tenant ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantId = tenant.id;

        // Create Flour: Initial stock 10kg @ ₦1,000/kg = ₦10,000
        const flour = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: 'Test Flour',
                unit: 'kg',
                category: 'Dry Goods',
                stock: 10,
                cost: 1000,
                totalValueOnHand: 10000
            }
        });
        itemFlourId = flour.id;

        // Create Sugar: Initial stock 5kg @ ₦1,500/kg = ₦7,500
        const sugar = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: 'Test Sugar',
                unit: 'kg',
                category: 'Dry Goods',
                stock: 5,
                cost: 1500,
                totalValueOnHand: 7500
            }
        });
        itemSugarId = sugar.id;
    });

    afterAll(async () => {
        if (tenantId) {
            await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('should edit purchase quantity and price on same item and update inventory stock and cost', async () => {
        // 1. Create a purchase for Flour: 2 packs of 10kg @ ₦12,000/pack (cpu 1200, stockAdded 20, total 24000)
        const reqCreate = {
            user: { tenantId },
            body: {
                date: new Date().toISOString(),
                supplier: 'Grain Mill Ltd',
                amount: 24000,
                itemId: itemFlourId,
                unitSize: 10,
                qty: 2,
                price: 12000,
                total: 24000,
                cpu: 1200,
                stockAdded: 20
            }
        };
        const purchase = await callController(createPurchase, reqCreate, mockRes());
        expect(purchase).toBeDefined();
        expect(purchase.id).toBeDefined();

        // Check Flour after purchase:
        // Stock: 10 + 20 = 30
        // Value: 10,000 + 24,000 = 34,000
        // Avg Cost: 34,000 / 30 = 1,133.33
        let flour = await prisma.inventoryItem.findUnique({ where: { id: itemFlourId } });
        expect(flour.stock).toBe(30);
        expect(flour.totalValueOnHand).toBe(34000);
        expect(flour.cost).toBeCloseTo(1133.33, 1);

        // 2. Edit purchase: user made a mistake and actually bought 3 packs of 10kg @ ₦12,000 (stockAdded 30, total 36000)
        const reqUpdate = {
            user: { tenantId },
            params: { id: purchase.id },
            body: {
                date: new Date().toISOString(),
                supplier: 'Grain Mill Ltd Updated',
                amount: 36000,
                itemId: itemFlourId,
                unitSize: 10,
                qty: 3,
                price: 12000,
                total: 36000,
                cpu: 1200,
                stockAdded: 30
            }
        };
        const updatedPurchase = await callController(updatePurchase, reqUpdate, mockRes());
        expect(updatedPurchase.qty).toBe(3);
        expect(updatedPurchase.total).toBe(36000);
        expect(updatedPurchase.supplier).toBe('Grain Mill Ltd Updated');

        // Check Flour after edit:
        // Stock was 30; delta is +10 => 40
        // Value was 34,000; delta is +12,000 => 46,000
        // Avg Cost: 46,000 / 40 = 1,150.00
        flour = await prisma.inventoryItem.findUnique({ where: { id: itemFlourId } });
        expect(flour.stock).toBe(40);
        expect(flour.totalValueOnHand).toBe(46000);
        expect(flour.cost).toBe(1150);

        // Verify InventoryHistory contains ADJUSTMENT
        const histories = await prisma.inventoryHistory.findMany({
            where: { tenantId, inventoryItemId: itemFlourId, referenceId: purchase.id, type: 'ADJUSTMENT' }
        });
        expect(histories.length).toBeGreaterThanOrEqual(1);
        expect(histories[0].qtyDelta).toBe(10);
        expect(histories[0].valueDelta).toBe(12000);
    });

    it('should edit purchase item from Flour to Sugar, reverting Flour and adding to Sugar', async () => {
        // 1. Create a purchase for Flour: 1 pack of 5kg @ ₦6,000 (cpu 1200, stockAdded 5, total 6000)
        const reqCreate = {
            user: { tenantId },
            body: {
                date: new Date().toISOString(),
                supplier: 'Local Depot',
                amount: 6000,
                itemId: itemFlourId,
                unitSize: 5,
                qty: 1,
                price: 6000,
                total: 6000,
                cpu: 1200,
                stockAdded: 5
            }
        };
        const purchase = await callController(createPurchase, reqCreate, mockRes());

        let flourBefore = await prisma.inventoryItem.findUnique({ where: { id: itemFlourId } });
        let sugarBefore = await prisma.inventoryItem.findUnique({ where: { id: itemSugarId } });

        // 2. Edit purchase: actually it was Sugar, not Flour! 1 pack of 5kg @ ₦7,500 (cpu 1500, stockAdded 5, total 7500)
        const reqUpdate = {
            user: { tenantId },
            params: { id: purchase.id },
            body: {
                date: new Date().toISOString(),
                supplier: 'Local Depot',
                amount: 7500,
                itemId: itemSugarId,
                unitSize: 5,
                qty: 1,
                price: 7500,
                total: 7500,
                cpu: 1500,
                stockAdded: 5
            }
        };
        await callController(updatePurchase, reqUpdate, mockRes());

        // Verify Flour stock was reduced by 5
        let flourAfter = await prisma.inventoryItem.findUnique({ where: { id: itemFlourId } });
        expect(flourAfter.stock).toBe(flourBefore.stock - 5);
        expect(flourAfter.totalValueOnHand).toBe(flourBefore.totalValueOnHand - 6000);

        // Verify Sugar stock was increased by 5
        let sugarAfter = await prisma.inventoryItem.findUnique({ where: { id: itemSugarId } });
        expect(sugarAfter.stock).toBe(sugarBefore.stock + 5);
        expect(sugarAfter.totalValueOnHand).toBe(sugarBefore.totalValueOnHand + 7500);

        // Check InventoryHistory
        const flourHistory = await prisma.inventoryHistory.findFirst({
            where: { tenantId, inventoryItemId: itemFlourId, referenceId: purchase.id, type: 'ADJUSTMENT' }
        });
        expect(flourHistory).toBeDefined();
        expect(flourHistory.qtyDelta).toBe(-5);

        const sugarHistory = await prisma.inventoryHistory.findFirst({
            where: { tenantId, inventoryItemId: itemSugarId, referenceId: purchase.id, type: 'PURCHASE' }
        });
        expect(sugarHistory).toBeDefined();
        expect(sugarHistory.qtyDelta).toBe(5);
    });
});
