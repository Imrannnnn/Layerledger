const mockPrisma = {
    tenant: {
        findUnique: jest.fn(),
        findMany: jest.fn()
    },
    order: {
        findMany: jest.fn(),
        count: jest.fn()
    },
    expense: {
        findMany: jest.fn(),
        count: jest.fn()
    },
    purchase: {
        findMany: jest.fn(),
        count: jest.fn()
    }
};

jest.mock('../prisma', () => mockPrisma);
const prisma = require('../prisma');

const financialAnalyticsService = require('../services/financialAnalyticsService');
const financialAssistantService = require('../services/financialAssistantService');
const {
    getAssistantStatus,
    getFinancialOverview,
    chatWithAssistant
} = require('../controller/financialAssistantController');

describe('AI Financial Assistant Unit & Business Logic Tests', () => {
    let req;
    let res;
    let next;

    const mockTenantId = 'tenant-premium-uuid';
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: {
                id: 'user-1',
                tenantId: mockTenantId,
                role: 'owner'
            },
            body: {},
            query: {}
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };

        next = jest.fn();
    });

    describe('1. Premium Feature Restriction & Access Control', () => {
        test('getAssistantStatus should return hasAccess: false when tenant is on Free plan', async () => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Free Bakery',
                settings: { plan: 'free' },
                tokenBalance: 20
            });

            await getAssistantStatus(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                hasAccess: false,
                plan: 'free',
                upgradePlan: 'premium',
                upgradePrice: 10000
            }));
        });

        test('getAssistantStatus should return hasAccess: false when tenant is on Standard plan', async () => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Standard Bakery',
                settings: { plan: 'standard', planExpiresAt: futureDate },
                tokenBalance: 40
            });

            await getAssistantStatus(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                hasAccess: false,
                plan: 'standard',
                upgradePlan: 'premium'
            }));
        });

        test('getAssistantStatus should return hasAccess: false when Premium plan is expired', async () => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Expired Premium Bakery',
                settings: { plan: 'premium', planExpiresAt: pastDate },
                tokenBalance: 0
            });

            await getAssistantStatus(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                hasAccess: false,
                isExpired: true,
                upgradePlan: 'premium'
            }));
        });

        test('getAssistantStatus should return hasAccess: true when tenant has active Premium subscription', async () => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Elite Luxe Bakery',
                settings: { plan: 'premium', planExpiresAt: futureDate },
                tokenBalance: 160
            });

            await getAssistantStatus(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                hasAccess: true,
                plan: 'premium',
                isExpired: false
            }));
        });

        test('chatWithAssistant should reject with 403 and PREMIUM_PLAN_REQUIRED if user is not on Premium', async () => {
            req.body = { question: 'What is my current profit margin?' };

            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Basic Bakery',
                settings: { plan: 'standard', planExpiresAt: futureDate }
            });

            await chatWithAssistant(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'PREMIUM_PLAN_REQUIRED',
                upgradePlan: 'premium'
            }));
        });

        test('getFinancialOverview should reject with 403 if user is on Free plan', async () => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Basic Bakery',
                settings: { plan: 'free' }
            });

            await getFinancialOverview(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                code: 'PREMIUM_PLAN_REQUIRED'
            }));
        });
    });

    describe('2. Financial Calculations & Business Logic Accuracy', () => {
        const sampleOrders = [
            {
                id: 'ord-1',
                tenantId: mockTenantId,
                status: 'delivered',
                totalPrice: 50000,
                totalCost: 20000,
                orderDate: new Date('2026-10-05'),
                metadata: {
                    salePrice: 50000,
                    cost: 20000,
                    productType: 'Cake',
                    deliveryDate: '2026-10-05',
                    paymentType: 'full'
                }
            },
            {
                id: 'ord-2',
                tenantId: mockTenantId,
                status: 'confirmed',
                totalPrice: 30000,
                totalCost: 10000,
                orderDate: new Date('2026-10-08'),
                metadata: {
                    salePrice: 30000,
                    cost: 10000,
                    productType: 'Pastry',
                    deliveryDate: '2026-10-08',
                    paymentType: 'full'
                }
            },
            {
                id: 'ord-3',
                tenantId: mockTenantId,
                status: 'confirmed',
                totalPrice: 15000,
                totalCost: 8000,
                orderDate: new Date('2026-10-09'),
                metadata: {
                    salePrice: 15000,
                    cost: 8000,
                    productType: 'Cake',
                    deliveryDate: '2026-10-09',
                    paymentType: 'gift', // Promotional Gift: Excluded from revenue
                    orderPurpose: 'gift'
                }
            }
        ];

        const sampleExpenses = [
            {
                id: 'exp-1',
                tenantId: mockTenantId,
                date: new Date('2026-10-04'),
                amount: 10000,
                category: 'Utilities',
                description: 'Electricity & Gas'
            },
            {
                id: 'exp-2',
                tenantId: mockTenantId,
                date: new Date('2026-10-06'),
                amount: 5000,
                category: 'Packaging',
                description: 'Cake boxes and ribbons'
            },
            {
                id: 'exp-3',
                tenantId: mockTenantId,
                date: new Date('2026-10-07'),
                amount: 4000,
                category: 'Purchases', // Ingredient Purchase: Excluded from overheads to avoid double-counting
                description: 'Purchase: Flour & Sugar'
            }
        ];

        const samplePurchases = [
            {
                id: 'pur-1',
                tenantId: mockTenantId,
                date: new Date('2026-10-07'),
                amount: 4000,
                supplier: 'Bakery Mart'
            }
        ];

        test('computePeriodMetrics accurately calculates Revenue, COGS, Gross Profit, Overheads, and Net Profit', () => {
            const metrics = financialAnalyticsService.computePeriodMetrics(sampleOrders, sampleExpenses, samplePurchases, 'October 2026');

            // Revenue: ord-1 (50,000) + ord-2 (30,000) = 80,000 (ord-3 is gift, excluded)
            expect(metrics.revenue).toBe(80000);

            // COGS: 20,000 + 10,000 + 8,000 = 38,000
            expect(metrics.cogs).toBe(38000);

            // Gross Profit: 80,000 - 38,000 = 42,000
            expect(metrics.grossProfit).toBe(42000);

            // Gross Margin %: (42,000 / 80,000) * 100 = 52.5%
            expect(metrics.grossMarginPct).toBe(52.5);

            // Overhead: Utilities (10,000) + Packaging (5,000) = 15,000 (exp-3 is purchase, excluded)
            expect(metrics.totalOverhead).toBe(15000);

            // Net Profit: 42,000 - 15,000 = 27,000
            expect(metrics.netProfit).toBe(27000);

            // Net Margin %: (27,000 / 80,000) * 100 = 33.75% -> 33.8%
            expect(metrics.netMarginPct).toBe(33.8);

            // Gift / Sample tracking
            expect(metrics.giftSampleOrderCount).toBe(1);
            expect(metrics.giftSampleCostTotal).toBe(8000);
        });

        test('productBreakdown ranks product types by profitability', () => {
            const metrics = financialAnalyticsService.computePeriodMetrics(sampleOrders, sampleExpenses, samplePurchases, 'October 2026');

            expect(metrics.productBreakdown.length).toBe(2); // Cake and Pastry
            const cakeProduct = metrics.productBreakdown.find(p => p.type === 'Cake');
            expect(cakeProduct).toBeDefined();
            expect(cakeProduct.revenue).toBe(50000);
            expect(cakeProduct.grossProfit).toBe(22000); // 50,000 - 28,000 (including gift cost)
        });
    });

    describe('3. Conversational Financial Intelligence Queries', () => {
        beforeEach(() => {
            prisma.tenant.findUnique.mockResolvedValue({
                id: mockTenantId,
                name: 'Delightful Bakes',
                settings: { plan: 'premium', planExpiresAt: futureDate },
                tokenBalance: 80
            });

            prisma.order.findMany.mockResolvedValue([
                {
                    id: 'o-1',
                    tenantId: mockTenantId,
                    status: 'delivered',
                    totalPrice: 100000,
                    totalCost: 40000,
                    orderDate: new Date('2026-10-10'),
                    metadata: {
                        salePrice: 100000,
                        cost: 40000,
                        productType: 'Wedding Cake',
                        cakeSummary: '3-tier Wedding Cake',
                        deliveryDate: '2026-10-10'
                    }
                }
            ]);

            prisma.expense.findMany.mockResolvedValue([
                {
                    id: 'e-1',
                    tenantId: mockTenantId,
                    date: new Date('2026-10-05'),
                    amount: 20000,
                    category: 'Packaging',
                    description: 'Luxury cake drums and boxes'
                }
            ]);

            prisma.purchase.findMany.mockResolvedValue([]);
        });

        test('answers "How much have I earned so far?" with exact figures and audit trace', async () => {
            const result = await financialAssistantService.answerFinancialQuery({
                tenantId: mockTenantId,
                question: 'How much have I earned so far?',
                targetMonth: '2026-10'
            });

            expect(result.answer).toContain('₦100,000');
            expect(result.metrics.revenue).toBe(100000);
            expect(result.auditTrace.ordersAnalyzed).toBeGreaterThanOrEqual(1);
            expect(result.suggestedQuestions.length).toBeGreaterThan(0);
        });

        test('answers "What is my current profit margin?" with gross and net profit margin steps', async () => {
            const result = await financialAssistantService.answerFinancialQuery({
                tenantId: mockTenantId,
                question: 'What is my current profit margin?',
                targetMonth: '2026-10'
            });

            expect(result.answer).toContain('Gross Profit Margin');
            expect(result.answer).toContain('Net Profit Margin');
            expect(result.metrics.grossMarginPct).toBe(60); // (60,000 / 100,000) * 100
            expect(result.metrics.netMarginPct).toBe(40); // (40,000 / 100,000) * 100
        });

        test('answers "What areas are reducing my profitability?" with top expense categories', async () => {
            const result = await financialAssistantService.answerFinancialQuery({
                tenantId: mockTenantId,
                question: 'What areas are reducing my profitability?',
                targetMonth: '2026-10'
            });

            expect(result.answer).toContain('Packaging');
            expect(result.answer).toContain('₦20,000');
            expect(result.answer).toContain('Recommendations');
        });

        test('answers combined estimate of earnings and profit margin with COMPLETE_MARGIN_ANALYSIS', async () => {
            const result = await financialAssistantService.answerFinancialQuery({
                tenantId: mockTenantId,
                question: 'Give me a complete estimate of how much I have earned and my profit margin',
                targetMonth: '2026-10'
            });

            expect(result.intent).toBe('COMPLETE_MARGIN_ANALYSIS');
            expect(result.answer).toContain('Complete Financial Estimate & Full Margin Analysis');
            expect(result.answer).toContain('₦100,000'); // Sales Revenue
            expect(result.answer).toContain('Gross Profit Margin');
            expect(result.answer).toContain('Net Profit Margin');
            expect(result.metrics.revenue).toBe(100000);
            expect(result.metrics.grossMarginPct).toBe(60);
            expect(result.metrics.netMarginPct).toBe(40);
        });

        test('chatWithAssistant endpoint returns 200 with complete structured response for premium user', async () => {
            req.body = { message: 'How much have I spent, and on what?' };

            await chatWithAssistant(req, res, next);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                answer: expect.any(String),
                metrics: expect.objectContaining({
                    revenue: 100000,
                    netProfit: 40000
                }),
                auditTrace: expect.objectContaining({
                    tenantId: mockTenantId
                })
            }));
        });
    });
});
