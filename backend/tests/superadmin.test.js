const mockPrisma = {
    tenant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    },
    payment: {
        findMany: jest.fn(),
        count: jest.fn()
    },
    tokenTransaction: {
        findMany: jest.fn(),
        create: jest.fn()
    },
    $transaction: jest.fn()
};

jest.mock('../prisma', () => mockPrisma);

// Mock email service
const mockEmailService = {
    sendPremiumAccessGrantedEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'mock-msg-1' }),
    sendMail: jest.fn().mockResolvedValue({ success: true })
};
jest.mock('../services/emailService', () => mockEmailService);

const jwt = require('jsonwebtoken');
const {
    superadminLogin,
    getDashboardStats,
    updateTenantStatus,
    adjustTenantTokens,
    grantTenantPremium
} = require('../controller/superadminController');

describe('Super Admin Controller Tests', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.SUPERADMIN_EMAIL = 'admin@bakewealth.com';
        process.env.SUPERADMIN_PASSWORD = 'supersecretpassword123';
        process.env.JWT_SECRET = 'test-jwt-secret';

        req = {
            body: {},
            params: {},
            headers: {},
            user: { role: 'superadmin' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };

        next = jest.fn();

        // Default $transaction mock execution
        mockPrisma.$transaction.mockImplementation(async (callbackOrArray) => {
            if (typeof callbackOrArray === 'function') {
                return callbackOrArray(mockPrisma);
            }
            return Promise.all(callbackOrArray);
        });
    });

    describe('superadminLogin', () => {
        test('authenticates successfully with matching admin credentials', async () => {
            req.body = { email: 'Admin@BakeWealth.com', password: 'supersecretpassword123' };

            await superadminLogin(req, res, next);

            expect(res.json).toHaveBeenCalled();
            const responseData = res.json.mock.calls[0][0];
            expect(responseData.email).toBe('admin@bakewealth.com');
            expect(responseData.token).toBeDefined();

            const decoded = jwt.verify(responseData.token, process.env.JWT_SECRET);
            expect(decoded.role).toBe('superadmin');
        });

        test('rejects incorrect password with 401', async () => {
            req.body = { email: 'admin@bakewealth.com', password: 'wrongpassword' };

            await superadminLogin(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid Admin Credentials' }));
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });

    describe('getDashboardStats', () => {
        test('returns aggregated metrics, subscription breakdown, paying counts and payment history', async () => {
            mockPrisma.tenant.count.mockResolvedValueOnce(10); // totalTenants
            mockPrisma.tenant.count.mockResolvedValueOnce(3);  // tenantsThisMonth
            mockPrisma.tenant.count.mockResolvedValueOnce(7);  // activeTenants30Days

            const futureExpires = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
            const pastExpires = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

            mockPrisma.tenant.findMany.mockResolvedValueOnce([
                {
                    id: 'tenant-1',
                    name: 'Sweet Crust Bakery',
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-03-01'),
                    tokenBalance: 40,
                    settings: {
                        plan: 'premium',
                        planExpiresAt: futureExpires,
                        grantedTrial: { days: 15, plan: 'premium' }
                    },
                    users: [{ email: 'owner1@crust.com', name: 'Alice Owner', role: 'owner' }],
                    payments: [
                        {
                            id: 'pay-1',
                            paymentReference: 'REF-100',
                            amount: 1000000, // ₦10,000 in minor kobo
                            createdAt: new Date('2026-03-01')
                        }
                    ],
                    _count: { recipes: 12, orders: 8, inventory: 40, expenses: 5 }
                },
                {
                    id: 'tenant-2',
                    name: 'Artisan Breads',
                    createdAt: new Date('2026-02-01'),
                    updatedAt: new Date('2026-03-01'),
                    tokenBalance: 0,
                    settings: {
                        plan: 'standard',
                        planExpiresAt: pastExpires // expired
                    },
                    users: [{ email: 'baker2@artisan.com', name: 'Bob Baker', role: 'owner' }],
                    payments: [],
                    _count: { recipes: 5, orders: 2, inventory: 15, expenses: 1 }
                }
            ]);

            mockPrisma.payment.findMany.mockResolvedValueOnce([
                {
                    id: 'pay-1',
                    paymentReference: 'LL-PAY-12345',
                    tenantId: 'tenant-1',
                    resourceType: 'subscription_plan',
                    resourceId: 'premium',
                    amount: 1000000, // ₦10,000
                    currency: 'NGN',
                    provider: 'paystack',
                    status: 'SUCCESS',
                    customerEmail: 'owner1@crust.com',
                    customerName: 'Alice Owner',
                    createdAt: new Date('2026-03-01'),
                    metadata: { months: 1, plan: 'premium' },
                    tenant: {
                        id: 'tenant-1',
                        name: 'Sweet Crust Bakery',
                        settings: { plan: 'premium', planExpiresAt: futureExpires },
                        users: [{ email: 'owner1@crust.com', name: 'Alice Owner' }]
                    }
                }
            ]);

            mockPrisma.tokenTransaction.findMany.mockResolvedValueOnce([
                { amount: 50 }
            ]);

            await getDashboardStats(req, res, next);

            expect(res.json).toHaveBeenCalled();
            const data = res.json.mock.calls[0][0];

            expect(data.stats.totalTenants).toBe(10);
            expect(data.stats.subscriptionAnalytics).toBeDefined();
            expect(data.stats.subscriptionAnalytics.totalPayingTenants).toBe(1);
            expect(data.stats.subscriptionAnalytics.activeSubscriptions).toBe(1);
            expect(data.stats.subscriptionAnalytics.expiredSubscriptions).toBe(1);
            expect(data.stats.subscriptionAnalytics.activeTrials).toBe(1);

            // Verify formatted payments
            expect(data.payments).toHaveLength(1);
            expect(data.payments[0].amount).toBe(10000); // minor units converted to major ₦10,000
            expect(data.payments[0].planExpiresAt).toBe(futureExpires);
            expect(data.payments[0].isExpired).toBe(false);

            // Verify formatted tenants
            expect(data.tenants).toHaveLength(2);
            expect(data.tenants[0].currentPlan).toBe('premium');
            expect(data.tenants[0].hasActiveTrial).toBe(true);
            expect(data.tenants[1].currentPlan).toBe('free'); // expired plan drops to free
            expect(data.tenants[1].isExpired).toBe(true);
        });
    });

    describe('grantTenantPremium', () => {
        test('grants premium plan for 2 days and sends notification email', async () => {
            const mockTenant = {
                id: 'tenant-abc-123',
                name: 'Golden Dough Bakery',
                tokenBalance: 15,
                settings: { plan: 'free' },
                users: [
                    { id: 'usr-1', email: 'owner@goldendough.com', name: 'Grace Baker', role: 'owner' }
                ]
            };

            mockPrisma.tenant.findUnique.mockResolvedValueOnce(mockTenant);
            mockPrisma.tenant.update.mockResolvedValueOnce({});
            mockPrisma.tokenTransaction.create.mockResolvedValueOnce({});

            req.params = { id: 'tenant-abc-123' };
            req.body = {
                days: 2,
                bonusCredits: 10,
                notifyEmail: true,
                note: 'Complimentary trial for high engagement'
            };

            await grantTenantPremium(req, res, next);

            expect(res.json).toHaveBeenCalled();
            const result = res.json.mock.calls[0][0];

            expect(result.message).toContain('Successfully granted 2 day(s) Premium plan access');
            expect(result.tenant.currentPlan).toBe('premium');
            expect(result.tenant.daysRemaining).toBe(2);
            expect(result.tenant.tokenBalance).toBe(25); // 15 + 10 bonus
            expect(result.tenant.grantedTrial.days).toBe(2);
            expect(result.emailSent).toBe(true);

            // Verify emailService called with correct arguments
            expect(mockEmailService.sendPremiumAccessGrantedEmail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'owner@goldendough.com',
                    name: 'Grace Baker',
                    companyName: 'Golden Dough Bakery',
                    daysGranted: 2,
                    bonusCredits: 10
                })
            );

            // Verify tenant settings updated with premium and planExpiresAt
            expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'tenant-abc-123' },
                    data: expect.objectContaining({
                        settings: expect.objectContaining({
                            plan: 'premium',
                            trialGranted: true,
                            trialBannerDismissed: false
                        })
                    })
                })
            );
        });

        test('stacks access onto future expiration date if tenant already has active plan', async () => {
            const existingFutureExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
            const mockTenant = {
                id: 'tenant-stacking',
                name: 'Stacking Bakery',
                tokenBalance: 5,
                settings: {
                    plan: 'standard',
                    planExpiresAt: existingFutureExpiry.toISOString()
                },
                users: [
                    { id: 'usr-2', email: 'owner@stacking.com', name: 'Sam Baker', role: 'owner' }
                ]
            };

            mockPrisma.tenant.findUnique.mockResolvedValueOnce(mockTenant);
            mockPrisma.tenant.update.mockResolvedValueOnce({});

            req.params = { id: 'tenant-stacking' };
            req.body = { days: 3 };

            await grantTenantPremium(req, res, next);

            expect(res.json).toHaveBeenCalled();
            const result = res.json.mock.calls[0][0];

            // New expiry should be ~8 days from now (5 + 3)
            const newExpiryTime = new Date(result.tenant.planExpiresAt).getTime();
            const expectedMinTime = existingFutureExpiry.getTime() + (3 * 24 * 60 * 60 * 1000) - 1000;
            expect(newExpiryTime).toBeGreaterThanOrEqual(expectedMinTime);
        });

        test('returns 400 if days is less than 1', async () => {
            req.params = { id: 'tenant-1' };
            req.body = { days: 0 };

            await grantTenantPremium(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Duration must be at least 1 day' }));
            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('returns 404 if tenant does not exist', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValueOnce(null);

            req.params = { id: 'non-existent-tenant' };
            req.body = { days: 2 };

            await grantTenantPremium(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tenant not found' }));
            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('updateTenantStatus & adjustTenantTokens', () => {
        test('updates tenant status to Suspended', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValueOnce({
                id: 't-1',
                settings: { status: 'Active' }
            });
            mockPrisma.tenant.update.mockResolvedValueOnce({
                id: 't-1',
                settings: { status: 'Suspended' }
            });

            req.params = { id: 't-1' };
            req.body = { status: 'Suspended' };

            await updateTenantStatus(req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Tenant status updated to Suspended' })
            );
        });

        test('adjusts tenant tokens with positive credit', async () => {
            mockPrisma.tenant.findUnique.mockResolvedValueOnce({
                id: 't-2',
                tokenBalance: 20
            });
            mockPrisma.tenant.update.mockResolvedValueOnce({});
            mockPrisma.tokenTransaction.create.mockResolvedValueOnce({});

            req.params = { id: 't-2' };
            req.body = { amount: 30, description: 'Support adjustment' };

            await adjustTenantTokens(req, res, next);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Tokens adjusted successfully',
                    newBalance: 50
                })
            );
        });
    });
});
