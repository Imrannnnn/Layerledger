require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
jest.setTimeout(30000);
const prisma = require('../prisma');
const {
    getTenantPricing,
    updateTenantPricing,
    resetTenantPricing
} = require('../controller/tenantController');

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

describe('Tenant Pricing Persistence Integration Tests', () => {
    let tenantAId;
    let tenantBId;

    beforeAll(async () => {
        const tenantA = await prisma.tenant.create({
            data: {
                name: `Pricing Test Tenant A ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantAId = tenantA.id;

        const tenantB = await prisma.tenant.create({
            data: {
                name: `Pricing Test Tenant B ${Date.now()}`,
                type: 'individual'
            }
        });
        tenantBId = tenantB.id;
    });

    afterAll(async () => {
        try {
            await prisma.tenant.deleteMany({
                where: { id: { in: [tenantAId, tenantBId] } }
            });
            await prisma.$disconnect();
        } catch (e) {
            // cleanup ignore
        }
    });

    test('GET /api/tenant/pricing returns default multipliers and margins initially', async () => {
        const req = { user: { tenantId: tenantAId, role: 'owner' } };
        const res = {};
        const pricing = await callController(getTenantPricing, req, res);

        expect(pricing).toBeDefined();
        expect(pricing.multipliers).toBeDefined();
        expect(pricing.multipliers['6-round']).toBe(1.0);
        expect(pricing.multipliers['8-round']).toBe(1.8);
        expect(pricing.profitPct).toBe(50);
        expect(pricing.overheadPct).toBe(27);
        expect(pricing.accessoryPct).toBe(10);
        expect(pricing.miscPct).toBe(5);
    });

    test('PUT /api/tenant/pricing persists customized multipliers and margins in PostgreSQL', async () => {
        const customMults = {
            '6-round': 1.0,
            '8-round': 2.0,
            '10-round': 3.5
        };
        const req = {
            user: { tenantId: tenantAId, role: 'owner' },
            body: {
                multipliers: customMults,
                profitPct: 60,
                overheadPct: 30,
                accessoryPct: 15,
                miscPct: 8
            }
        };
        const res = {};
        const updated = await callController(updateTenantPricing, req, res);

        expect(updated.multipliers['8-round']).toBe(2.0);
        expect(updated.profitPct).toBe(60);
        expect(updated.overheadPct).toBe(30);

        // Verify direct from DB
        const dbTenant = await prisma.tenant.findUnique({ where: { id: tenantAId } });
        expect(dbTenant.settings.pricing.multipliers['8-round']).toBe(2.0);
        expect(dbTenant.settings.pricing.profitPct).toBe(60);
    });

    test('Multi-tenant isolation: Tenant B does not see Tenant A customized multipliers', async () => {
        const reqB = { user: { tenantId: tenantBId, role: 'owner' } };
        const resB = {};
        const pricingB = await callController(getTenantPricing, reqB, resB);

        // Tenant B should still have default 1.8 for 8-round, not Tenant A's 2.0
        expect(pricingB.multipliers['8-round']).toBe(1.8);
        expect(pricingB.profitPct).toBe(50);
    });

    test('POST /api/tenant/pricing/reset resets multipliers and margins to defaults in PostgreSQL', async () => {
        const resetReq = { user: { tenantId: tenantAId, role: 'owner' } };
        const resetRes = {};
        const resetPricing = await callController(resetTenantPricing, resetReq, resetRes);

        expect(resetPricing.multipliers['8-round']).toBe(1.8);
        expect(resetPricing.profitPct).toBe(50);

        // Verify direct from DB
        const dbTenant = await prisma.tenant.findUnique({ where: { id: tenantAId } });
        expect(dbTenant.settings.pricing.multipliers['8-round']).toBe(1.8);
    });
});
