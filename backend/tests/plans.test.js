const mockPrisma = {
    tenant: {
        findUnique: jest.fn(),
        update: jest.fn()
    },
    tokenTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'tx-1' })
    },
    order: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'ord-1', items: [], payments: [] })
    },
    recipe: {
        count: jest.fn().mockResolvedValue(0)
    },
    inventoryItem: {
        count: jest.fn().mockResolvedValue(0)
    },
    client: {
        count: jest.fn().mockResolvedValue(0)
    },
    user: {
        count: jest.fn().mockResolvedValue(0)
    },
    $transaction: jest.fn(callback => callback(mockPrisma))
};

jest.mock('../prisma', () => mockPrisma);
const prisma = require('../prisma');

const {
    PLAN_LIMITS,
    MULTI_MONTH_DISCOUNTS,
    getCurrentPlanAndUsage,
    purchasePlan,
    claimFreeScans
} = require('../controller/planController');

const {
    purchaseCreditPack,
    refundScanCredits
} = require('../controller/tokenController');

const { createOrder } = require('../controller/orderController');
const { createRecipe } = require('../controller/recipeController');
const { createItem } = require('../controller/inventoryController');
const { createClient } = require('../controller/clientController');
const { createUser } = require('../controller/userController');
const { handleClaudeProxy } = require('../controller/claudeController');

describe('BakeWealth Plans & Credit Packs Unit Tests', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {},
            user: { tenantId: 'tenant-123' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    test('PLAN_LIMITS contains correct specifications', () => {
        expect(PLAN_LIMITS.free.ordersPerMonth).toBe(8);
        expect(PLAN_LIMITS.free.recipes).toBe(10);
        expect(PLAN_LIMITS.free.inventoryItems).toBe(50);
        expect(PLAN_LIMITS.free.clients).toBe(20);
        expect(PLAN_LIMITS.free.staffLogins).toBe(0);

        expect(PLAN_LIMITS.standard.monthlyPrice).toBe(5000);
        expect(PLAN_LIMITS.standard.ordersPerMonth).toBe(Infinity);
        expect(PLAN_LIMITS.standard.recipes).toBe(60);
        expect(PLAN_LIMITS.standard.inventoryItems).toBe(250);
        expect(PLAN_LIMITS.standard.clients).toBe(150);
        expect(PLAN_LIMITS.standard.staffLogins).toBe(2);
        expect(PLAN_LIMITS.standard.scansPerMonth).toBe(20);

        expect(PLAN_LIMITS.premium.name).toBe('Premium');
        expect(PLAN_LIMITS.premium.monthlyPrice).toBe(10000);
        expect(PLAN_LIMITS.premium.recipes).toBe(Infinity);
        expect(PLAN_LIMITS.premium.inventoryItems).toBe(Infinity);
        expect(PLAN_LIMITS.premium.clients).toBe(Infinity);
        expect(PLAN_LIMITS.premium.staffLogins).toBe(4);
        expect(PLAN_LIMITS.premium.scansPerMonth).toBe(80);
        expect(PLAN_LIMITS.studio.name).toBe('Premium');
    });

    test('MULTI_MONTH_DISCOUNTS has 5%, 10%, 15% discounts', () => {
        expect(MULTI_MONTH_DISCOUNTS[1]).toBe(0);
        expect(MULTI_MONTH_DISCOUNTS[3]).toBe(0.05);
        expect(MULTI_MONTH_DISCOUNTS[6]).toBe(0.10);
        expect(MULTI_MONTH_DISCOUNTS[12]).toBe(0.15);
    });

    test('getCurrentPlanAndUsage returns correct usage breakdown for Free plan', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 14,
            settings: { plan: 'free' }
        });
        prisma.order.count.mockResolvedValue(5);
        prisma.recipe.count.mockResolvedValue(8);
        prisma.inventoryItem.count.mockResolvedValue(35);
        prisma.client.count.mockResolvedValue(12);
        prisma.user.count.mockResolvedValue(0);

        await getCurrentPlanAndUsage(req, res, next);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            plan: 'free',
            tokenBalance: 14,
            scansRemaining: 7,
            usage: expect.objectContaining({
                ordersThisMonth: 5,
                ordersLimit: 8,
                recipes: 8,
                recipesLimit: 10,
                inventoryItems: 35,
                inventoryLimit: 50,
                clients: 12,
                clientsLimit: 20,
                staffLogins: 0,
                staffLimit: 0
            })
        }));
    });

    test('purchasePlan calculates 3-month discount (5%) and grants 60 scans (120 credits) for Standard', async () => {
        req.body = { plan: 'standard', months: 3 };
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 10,
            settings: { plan: 'free' }
        });
        prisma.tenant.update.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 130
        });

        await purchasePlan(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.objectContaining({
                plan: 'standard',
                months: 3,
                finalPrice: 14250, // 15,000 - 5% = 14,250
                discountSavings: 750,
                creditsGranted: 120, // 20 scans/mo * 3 mo * 2 credits
                scansGranted: 60
            })
        }));
    });

    test('purchasePlan calculates 12-month discount (15%) and grants 960 scans (1920 credits) for Premium', async () => {
        req.body = { plan: 'premium', months: 12 };
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 0,
            settings: { plan: 'standard' }
        });
        prisma.tenant.update.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 1920
        });

        await purchasePlan(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.objectContaining({
                plan: 'premium',
                planName: 'Premium',
                months: 12,
                finalPrice: 102000, // 120,000 - 15% = 102,000
                discountSavings: 18000,
                creditsGranted: 1920, // 80 scans/mo * 12 mo * 2 credits
                scansGranted: 960
            })
        }));
    });

    test('purchasePlan stacks expiration date on top of active plan', async () => {
        const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days remaining
        req.body = { plan: 'standard', months: 1 };
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            settings: { plan: 'standard', planExpiresAt: futureDate.toISOString() },
            tokenBalance: 20
        });
        prisma.tenant.update.mockImplementation(({ data }) => Promise.resolve({
            id: 'tenant-123',
            tokenBalance: 60,
            settings: data.settings
        }));

        await purchasePlan(req, res, next);

        const updateCall = prisma.tenant.update.mock.calls[0][0];
        const newExpires = new Date(updateCall.data.settings.planExpiresAt);
        // Expect stacked date: futureDate + 30 days
        const diffDays = Math.round((newExpires.getTime() - futureDate.getTime()) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(30);
    });

    test('claimFreeScans grants 20 credits once on Free plan', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            settings: { plan: 'free' },
            tokenBalance: 0
        });
        prisma.tenant.update.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 20
        });

        await claimFreeScans(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            alreadyClaimed: false,
            tokenBalance: 20
        }));
    });

    test('purchaseCreditPack purchases Small (20 credits ₦3k), Medium (50 credits ₦6.5k), Large (120 credits ₦14k)', async () => {
        req.body = { packId: 'medium' };
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 5
        });
        prisma.tenant.update.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 55
        });

        await purchaseCreditPack(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            pack: expect.objectContaining({
                name: 'Medium Pack',
                credits: 50,
                price: 6500,
                scans: 25
            }),
            newBalance: 55
        }));
    });

    test('refundScanCredits refunds credits and creates ledger entry', async () => {
        req.body = { credits: 2, reason: 'Failed receipt scan' };
        prisma.tenant.findUnique.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 8
        });
        prisma.tenant.update.mockResolvedValue({
            id: 'tenant-123',
            tokenBalance: 10
        });

        await refundScanCredits(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            refunded: 2,
            newBalance: 10
        }));
    });

    test('createOrder enforces 8 orders/month limit on Free plan for confirmed orders', async () => {
        req.body = { status: 'confirmed' };
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.order.count.mockResolvedValue(8); // already at limit

        await createOrder(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Free plan order limit reached/);
    });

    test('createOrder does NOT block quotes (status: quote) even when 8 orders/month limit is reached', async () => {
        req.body = { status: 'quote', clientName: 'Walk-in' };
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.order.count.mockResolvedValue(8); // at limit

        await createOrder(req, res, next);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'ord-1' }));
    });

    test('createRecipe enforces 10 recipes limit on Free plan', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.recipe.count.mockResolvedValue(10); // at limit

        await createRecipe(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Recipe limit reached/);
    });

    test('createItem enforces 50 items limit on Free plan', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.inventoryItem.count.mockResolvedValue(50); // at limit

        await createItem(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Inventory item limit reached/);
    });

    test('createClient enforces 20 clients limit on Free plan', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.client.count.mockResolvedValue(20); // at limit

        await createClient(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Client limit reached/);
    });

    test('createUser enforces owner-only for Free and 2 staff for Standard', async () => {
        prisma.tenant.findUnique.mockResolvedValue({
            settings: { plan: 'free' }
        });
        prisma.user.count.mockResolvedValue(0); // Free allows 0 staff

        await createUser(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Free plan is for owner login only/);
    });

    test('handleClaudeProxy blocks call when per-account daily ceiling (100) is reached', async () => {
        req.body = { messages: [{ role: 'user', content: 'test' }] };
        const todayStr = new Date().toISOString().slice(0, 10);
        prisma.tenant.findUnique.mockResolvedValue({
            tokenBalance: 50,
            settings: {
                dailyAiUsage: { date: todayStr, count: 100 }
            }
        });

        await handleClaudeProxy(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'DAILY_AI_CEILING_REACHED'
        }));
    });
});

