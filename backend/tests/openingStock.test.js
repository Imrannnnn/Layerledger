require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(30000);
const prisma = require('../prisma');
const {
    getOpeningStock,
    createOpeningStock,
    bulkSyncOpeningStock,
    updateOpeningStock,
    lockMonthOpeningStock,
    deleteOpeningStockItem,
    deleteAllOpeningStock
} = require('../controller/openingStockController');

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

describe('Opening Stock Dedicated Table Integration Tests', () => {
    let tenantId;
    let testMonth = '2026-09';

    beforeAll(async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: `OpeningStock Test Tenant ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantId = tenant.id;
    });

    afterAll(async () => {
        try {
            await prisma.openingStock.deleteMany({ where: { tenantId } });
            await prisma.tenant.delete({ where: { id: tenantId } });
            await prisma.$disconnect();
        } catch (e) {
            // cleanup error ignore
        }
    });

    test('POST /api/opening-stock creates a single opening stock row', async () => {
        const req = {
            user: { tenantId, role: 'owner' },
            body: {
                name: 'Flour Premium',
                unit: 'kg',
                cost: 1500,
                openingQty: 20,
                month: testMonth
            }
        };
        const res = {};
        const created = await callController(createOpeningStock, req, res);

        expect(created).toBeDefined();
        expect(created.name).toBe('Flour Premium');
        expect(created.unit).toBe('kg');
        expect(created.cost).toBe(1500);
        expect(created.openingQty).toBe(20);
        expect(created.totalValue).toBe(30000);
        expect(created.month).toBe(testMonth);
    });

    test('POST /api/opening-stock/bulk batch syncs multiple items', async () => {
        const req = {
            user: { tenantId, role: 'owner' },
            body: {
                month: testMonth,
                locked: false,
                items: [
                    { name: 'Flour Premium', unit: 'kg', cost: 1500, openingQty: 25 },
                    { name: 'Caster Sugar', unit: 'kg', cost: 2200, openingQty: 10 },
                    { name: 'Butter Unsalted', unit: 'kg', cost: 4500, openingQty: 5 }
                ]
            }
        };
        const res = {};
        const bulkItems = await callController(bulkSyncOpeningStock, req, res);

        expect(Array.isArray(bulkItems)).toBe(true);
        expect(bulkItems.length).toBe(3);
        const sugar = bulkItems.find(i => i.name === 'Caster Sugar');
        expect(sugar).toBeDefined();
        expect(sugar.totalValue).toBe(22000);
    });

    test('GET /api/opening-stock returns opening stock for tenant', async () => {
        const req = {
            user: { tenantId, role: 'owner' },
            query: { month: testMonth }
        };
        const res = {};
        const items = await callController(getOpeningStock, req, res);

        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(3);
    });

    test('GET /api/opening-stock with search and pagination works', async () => {
        const req = {
            user: { tenantId, role: 'owner' },
            query: { month: testMonth, search: 'sugar', page: 1, limit: 10 }
        };
        const res = {};
        const result = await callController(getOpeningStock, req, res);

        expect(result.pagination).toBeDefined();
        expect(result.pagination.total).toBe(1);
        expect(result.items.length).toBe(1);
        expect(result.items[0].name).toBe('Caster Sugar');
    });

    test('PUT /api/opening-stock/lock locks and unlocks month records', async () => {
        const lockReq = {
            user: { tenantId, role: 'owner' },
            body: { month: testMonth, locked: true }
        };
        const res = {};
        const lockRes = await callController(lockMonthOpeningStock, lockReq, res);

        expect(lockRes.locked).toBe(true);
        expect(lockRes.items.every(i => i.locked === true)).toBe(true);

        const unlockReq = {
            user: { tenantId, role: 'owner' },
            body: { month: testMonth, locked: false }
        };
        const unlockRes = await callController(lockMonthOpeningStock, unlockReq, res);
        expect(unlockRes.locked).toBe(false);
        expect(unlockRes.items.every(i => i.locked === false)).toBe(true);
    });

    test('PUT /api/opening-stock/:id updates an individual opening stock entry', async () => {
        const fetchReq = {
            user: { tenantId, role: 'owner' },
            query: { month: testMonth }
        };
        const items = await callController(getOpeningStock, fetchReq, {});
        const target = items[0];

        const updateReq = {
            user: { tenantId, role: 'owner' },
            params: { id: target.id },
            body: {
                openingQty: 40,
                cost: 1600
            }
        };
        const res = {};
        const updated = await callController(updateOpeningStock, updateReq, res);

        expect(updated.id).toBe(target.id);
        expect(updated.openingQty).toBe(40);
        expect(updated.cost).toBe(1600);
        expect(updated.totalValue).toBe(64000);
    });

    test('DELETE /api/opening-stock/:id deletes a single item', async () => {
        const fetchReq = {
            user: { tenantId, role: 'owner' },
            query: { month: testMonth }
        };
        const items = await callController(getOpeningStock, fetchReq, {});
        const target = items[0];

        const delReq = {
            user: { tenantId, role: 'owner' },
            params: { id: target.id }
        };
        const res = {};
        const delRes = await callController(deleteOpeningStockItem, delReq, res);

        expect(delRes.message).toBe('Opening stock item deleted successfully');

        const remaining = await callController(getOpeningStock, fetchReq, {});
        expect(remaining.length).toBe(items.length - 1);
    });

    test('DELETE /api/opening-stock clears all opening stock records', async () => {
        const clearReq = {
            user: { tenantId, role: 'owner' },
            query: { month: testMonth }
        };
        const res = {};
        const clearRes = await callController(deleteAllOpeningStock, clearReq, res);

        expect(clearRes.message).toBe('Opening stock records deleted successfully');

        const remaining = await callController(getOpeningStock, clearReq, {});
        expect(remaining.length).toBe(0);
    });
});

