/**
 * ----------------------------------------------------------------------
 * Plan Controller
 * ----------------------------------------------------------------------
 * Manages BakeWealth prepaid subscription plans, multi-month discounts,
 * stackable expirations, and live quota usage tracking.
 * ----------------------------------------------------------------------
 */

const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

const PLAN_LIMITS = {
    free: {
        id: 'free',
        name: 'Free',
        monthlyPrice: 0,
        ordersPerMonth: 8,
        recipes: 10,
        inventoryItems: 50,
        clients: 20,
        staffLogins: 0, // Owner only
        scansPerMonth: 0, // 10 free scans once on registration
        invoiceBranding: 'BakeWealth mark',
        accountingReports: 'Full'
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        monthlyPrice: 5000,
        ordersPerMonth: Infinity,
        recipes: 60,
        inventoryItems: 250,
        clients: 150,
        staffLogins: 2,
        scansPerMonth: 20, // 40 credits per month
        invoiceBranding: 'BakeWealth mark',
        accountingReports: 'Full'
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        monthlyPrice: 10000,
        ordersPerMonth: Infinity,
        recipes: Infinity,
        inventoryItems: Infinity,
        clients: Infinity,
        staffLogins: 4,
        scansPerMonth: 80, // 160 credits per month
        invoiceBranding: 'Removed, own logo',
        accountingReports: 'Full'
    },
    studio: {
        id: 'premium',
        name: 'Premium',
        monthlyPrice: 10000,
        ordersPerMonth: Infinity,
        recipes: Infinity,
        inventoryItems: Infinity,
        clients: Infinity,
        staffLogins: 4,
        scansPerMonth: 80, // 160 credits per month
        invoiceBranding: 'Removed, own logo',
        accountingReports: 'Full'
    }
};

const MULTI_MONTH_DISCOUNTS = {
    1: 0,
    3: 0.05,  // 5% discount
    6: 0.10,  // 10% discount
    12: 0.15  // 15% discount
};

/**
 * Determine effective plan accounting for prepaid expiration
 */
const getEffectivePlan = (tenant) => {
    let rawPlan = (tenant?.settings?.plan || 'free').toLowerCase();
    if (rawPlan === 'studio') rawPlan = 'premium';
    const planExpiresAt = tenant?.settings?.planExpiresAt ? new Date(tenant.settings.planExpiresAt) : null;
    const now = new Date();

    if (rawPlan === 'standard' || rawPlan === 'premium') {
        if (!planExpiresAt || planExpiresAt.getTime() < now.getTime()) {
            return {
                plan: 'free',
                isExpired: true,
                rawPlan,
                planExpiresAt: planExpiresAt ? planExpiresAt.toISOString() : null,
                daysRemaining: 0
            };
        }
        const diffMs = planExpiresAt.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return {
            plan: rawPlan,
            isExpired: false,
            rawPlan,
            planExpiresAt: planExpiresAt.toISOString(),
            daysRemaining
        };
    }

    return {
        plan: 'free',
        isExpired: false,
        rawPlan: 'free',
        planExpiresAt: null,
        daysRemaining: null
    };
};

/**
 * @desc    Get current plan, live usage vs limits, and quota status
 * @route   GET /api/plans/current
 * @access  Private
 */
const getCurrentPlanAndUsage = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            id: true,
            name: true,
            tokenBalance: true,
            settings: true,
            createdAt: true
        }
    });

    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const effective = getEffectivePlan(tenant);
    const planId = effective.plan;
    const planConfig = PLAN_LIMITS[planId] || PLAN_LIMITS.free;

    // Calculate usage
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [ordersCountThisMonth, recipesCount, inventoryCount, clientsCount, staffCount] = await Promise.all([
        prisma.order.count({
            where: {
                tenantId,
                status: { not: 'quote' },
                createdAt: { gte: startOfMonth }
            }
        }),
        prisma.recipe.count({ where: { tenantId } }),
        prisma.inventoryItem.count({ where: { tenantId } }),
        prisma.client.count({ where: { tenantId } }),
        prisma.user.count({
            where: {
                tenantId,
                role: { not: 'owner' }
            }
        })
    ]);

    const scansRemaining = Math.floor((tenant.tokenBalance || 0) / 2);

    res.json({
        plan: planId,
        rawPlan: effective.rawPlan,
        isExpired: effective.isExpired,
        planExpiresAt: effective.planExpiresAt,
        daysRemaining: effective.daysRemaining,
        tokenBalance: tenant.tokenBalance || 0,
        scansRemaining,
        limits: planConfig,
        usage: {
            ordersThisMonth: ordersCountThisMonth,
            ordersLimit: planConfig.ordersPerMonth,
            recipes: recipesCount,
            recipesLimit: planConfig.recipes,
            inventoryItems: inventoryCount,
            inventoryLimit: planConfig.inventoryItems,
            clients: clientsCount,
            clientsLimit: planConfig.clients,
            staffLogins: staffCount,
            staffLimit: planConfig.staffLogins
        },
        freeScansGranted: Boolean(tenant.settings?.freeScansGranted)
    });
});

/**
 * @desc    Purchase or stack a prepaid plan with multi-month discount
 * @route   POST /api/plans/purchase
 * @access  Private (Owner only)
 */
const purchasePlan = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { plan, months, reference } = req.body;

    let targetPlan = (plan || '').toLowerCase();
    if (targetPlan === 'studio') targetPlan = 'premium';
    if (targetPlan !== 'standard' && targetPlan !== 'premium') {
        res.status(400);
        throw new Error('Invalid plan. Choose "standard" or "premium".');
    }

    const parsedMonths = parseInt(months, 10);
    if (![1, 3, 6, 12].includes(parsedMonths)) {
        res.status(400);
        throw new Error('Invalid duration. Choose 1, 3, 6, or 12 months.');
    }

    const config = PLAN_LIMITS[targetPlan];
    const discountRate = MULTI_MONTH_DISCOUNTS[parsedMonths] || 0;
    const basePrice = config.monthlyPrice * parsedMonths;
    const discountAmount = Math.round(basePrice * discountRate);
    const finalPrice = basePrice - discountAmount;

    // Scans granted: 20 per month for Standard (40 credits), 80 per month for Premium (160 credits)
    const monthlyCredits = config.scansPerMonth * 2;
    const totalCreditsGranted = monthlyCredits * parsedMonths;

    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            throw new Error('Tenant not found');
        }

        const now = new Date();
        const existingSettings = tenant.settings || {};
        const currentExpires = existingSettings.planExpiresAt ? new Date(existingSettings.planExpiresAt) : null;

        // Calculate stackable expiry:
        // If current plan is active and not expired, stack from that date; otherwise from now.
        let baseDate = now;
        if (currentExpires && currentExpires.getTime() > now.getTime()) {
            baseDate = currentExpires;
        }

        const newExpires = new Date(baseDate.getTime() + parsedMonths * 30 * 24 * 60 * 60 * 1000);

        const updatedSettings = {
            ...existingSettings,
            plan: targetPlan,
            planExpiresAt: newExpires.toISOString(),
            lastLowTokenAlertSent: false,
            lastLowTokenAlertBalance: null,
            lastExpiryWarningDate: null,
            lastPlanPurchase: {
                plan: targetPlan,
                months: parsedMonths,
                basePrice,
                discountRate,
                discountAmount,
                finalPrice,
                creditsGranted: totalCreditsGranted,
                reference: reference || `PLAN-${Date.now()}`,
                purchasedAt: now.toISOString()
            }
        };

        // 1. Update Tenant with new plan settings and incremented scan credits
        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: {
                settings: updatedSettings,
                tokenBalance: {
                    increment: totalCreditsGranted
                }
            }
        });

        // 2. Record Token Transaction ledger entry for the granted credits
        const tokenTx = await tx.tokenTransaction.create({
            data: {
                tenantId,
                amount: totalCreditsGranted,
                type: 'plan_scans_granted',
                description: `Prepaid ${config.name} plan (${parsedMonths} mo): +${totalCreditsGranted} scan credits (${config.scansPerMonth * parsedMonths} scans)`
            }
        });

        return {
            tenant: updatedTenant,
            tokenTransaction: tokenTx,
            purchaseDetails: {
                plan: targetPlan,
                planName: config.name,
                months: parsedMonths,
                finalPrice,
                discountSavings: discountAmount,
                creditsGranted: totalCreditsGranted,
                scansGranted: config.scansPerMonth * parsedMonths,
                newExpiresAt: newExpires.toISOString()
            }
        };
    });

    res.status(200).json({
        message: `Successfully purchased ${result.purchaseDetails.planName} plan for ${parsedMonths} month${parsedMonths > 1 ? 's' : ''}.`,
        details: result.purchaseDetails,
        tokenBalance: result.tenant.tokenBalance
    });
});

/**
 * @desc    Claim one-time free 10 scans (20 credits) for free accounts if not yet received
 * @route   POST /api/plans/claim-free
 * @access  Private
 */
const claimFreeScans = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
            where: { id: tenantId }
        });

        if (!tenant) {
            res.status(404);
            throw new Error('Tenant not found');
        }

        const settings = tenant.settings || {};
        if (settings.freeScansGranted) {
            return {
                alreadyClaimed: true,
                message: 'Free 10 scans allowance has already been claimed.',
                tokenBalance: tenant.tokenBalance
            };
        }

        const updatedSettings = {
            ...settings,
            freeScansGranted: true,
            freeScansClaimedAt: new Date().toISOString()
        };

        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: {
                settings: updatedSettings,
                tokenBalance: {
                    increment: 20 // 10 scans * 2 credits
                }
            }
        });

        await tx.tokenTransaction.create({
            data: {
                tenantId,
                amount: 20,
                type: 'bonus',
                description: 'Initial welcome allowance: 10 free scans (20 credits)'
            }
        });

        return {
            alreadyClaimed: false,
            message: '10 free scans (20 credits) granted!',
            tokenBalance: updatedTenant.tokenBalance
        };
    });

    res.status(200).json(result);
});

module.exports = {
    PLAN_LIMITS,
    MULTI_MONTH_DISCOUNTS,
    getEffectivePlan,
    getCurrentPlanAndUsage,
    purchasePlan,
    claimFreeScans
};
