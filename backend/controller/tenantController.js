/**
 * ----------------------------------------------------------------------
 * Tenant Controller
 * ----------------------------------------------------------------------
 * Purpose: Manages the organization's or individual's workspace details.
 */

const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { clearUserCache } = require('../middleware/authMiddleware');

/**
 * @desc    Get current tenant details and settings
 * @route   GET /api/tenant
 * @access  Private (Requires valid JWT with tenantId)
 */
const getTenantDetails = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId; 

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    res.json(tenant);
});

/**
 * @desc    Update current tenant details (e.g. company name, address, settings)
 * @route   PUT /api/tenant
 * @access  Private (Requires valid JWT and likely 'owner' role)
 */
const updateTenantDetails = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, contactEmail, contactPhone, settings } = req.body;

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    let mergedSettings = existingTenant.settings || {};
    if (settings) {
        const existingConfig = (existingTenant.settings && existingTenant.settings.appConfig) || {};
        const incomingConfig = settings.appConfig || {};

        mergedSettings = {
            ...existingTenant.settings,
            ...settings,
            appConfig: {
                ...existingConfig,
                ...incomingConfig
            }
        };
    }

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            name: name !== undefined ? name : existingTenant.name,
            contactEmail: contactEmail !== undefined ? contactEmail : existingTenant.contactEmail,
            contactPhone: contactPhone !== undefined ? contactPhone : existingTenant.contactPhone,
            settings: mergedSettings
        }
    });

    res.json(updatedTenant);
});

/**
 * @desc    Clear all tenant data directly from the database (Danger zone reset)
 * @route   DELETE /api/tenant/data
 * @access  Private (Owner only)
 */
const clearAllTenantData = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    await prisma.$transaction(async (tx) => {
        // 1. Unlink purchases before deleting inventory items
        await tx.purchase.updateMany({
            where: { tenantId, itemId: { not: null } },
            data: { itemId: null }
        });

        // 2. Delete purchases
        await tx.purchase.deleteMany({ where: { tenantId } });

        // 3. Delete inventory history
        await tx.inventoryHistory.deleteMany({ where: { tenantId } });

        // 4. Delete recipe ingredients
        await tx.recipeIngredient.deleteMany({
            where: { recipe: { tenantId } }
        });

        // 5. Delete order payments & order items & invoices
        await tx.orderPayment.deleteMany({
            where: { order: { tenantId } }
        });
        await tx.orderItem.deleteMany({
            where: { order: { tenantId } }
        });
        await tx.invoice.deleteMany({ where: { tenantId } });

        // 6. Delete orders
        await tx.order.deleteMany({ where: { tenantId } });

        // 7. Delete recipes
        await tx.recipe.deleteMany({ where: { tenantId } });

        // 8. Delete inventory items
        await tx.inventoryItem.deleteMany({ where: { tenantId } });

        // 8b. Delete opening stock
        await tx.openingStock.deleteMany({ where: { tenantId } });

        // 9. Delete expenses and transactions
        await tx.expense.deleteMany({ where: { tenantId } });
        await tx.transaction.deleteMany({ where: { tenantId } });

        // 10. Delete packaging and decorations
        await tx.packaging.deleteMany({ where: { tenantId } });
        await tx.decoration.deleteMany({ where: { tenantId } });

        // 11. Delete clients
        await tx.client.deleteMany({ where: { tenantId } });

        // 12. Reset tenant settings in database to empty configs
        const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
        const existingSettings = (tenant && tenant.settings) || {};
        await tx.tenant.update({
            where: { id: tenantId },
            data: {
                settings: {
                    ...existingSettings,
                    appConfig: {}
                }
            }
        });
    }, { maxWait: 10000, timeout: 45000 });

        res.json({ message: 'All tenant data cleared successfully from database' });
});

/**
 * @desc    Get complete tenant bootstrap data in a single optimized database query
 * @route   GET /api/tenant/bootstrap
 * @access  Private
 */
const getTenantBootstrap = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    // Run queries sequentially reusing a single connection pool socket to prevent Neon pool exhaustion & 10s timeout
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const inventory = await prisma.inventoryItem.findMany({ where: { tenantId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    const openingStock = await prisma.openingStock.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
    const recipes = await prisma.recipe.findMany({ where: { tenantId }, include: { ingredients: true } });
    const orders = await prisma.order.findMany({
        where: { tenantId },
        include: { client: { select: { name: true, phone: true } } },
        orderBy: { orderDate: 'desc' }
    });
    const expenses = await prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
    const purchases = await prisma.purchase.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
    const invoices = await prisma.invoice.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
    const transactions = await prisma.transaction.findMany({ where: { tenantId }, orderBy: { date: 'desc' } });
    const clients = await prisma.client.findMany({ where: { tenantId }, include: { _count: { select: { orders: true } } }, orderBy: { name: 'asc' } });


    res.json({
        tenant,
        inventory,
        openingStock,
        recipes,
        orders,
        expenses,
        purchases,
        invoices,
        transactions,
        clients
    });
});

const DEFAULT_MULTS = {
    "4-round": 0.5, "4-square": 0.6, "4-sheet": 0.8,
    "5-round": 0.7, "5-square": 0.85, "5-sheet": 0.9,
    "6-round": 1.0, "6-square": 1.2, "6-sheet": 1.3,
    "7-round": 1.4, "7-square": 1.65, "7-sheet": 1.7,
    "8-round": 1.8, "8-square": 2.15, "8-sheet": 2.2,
    "9-round": 2.3, "9-square": 2.75, "9-sheet": 2.8,
    "10-round": 2.8, "10-square": 3.35, "10-sheet": 3.4,
    "12-round": 4.0, "12-square": 4.8, "12-sheet": 4.9,
    "14-round": 5.5, "14-square": 6.6, "14-sheet": 6.7
};

const DEFAULT_MARGINS = {
    profitPct: 50,
    overheadPct: 27,
    accessoryPct: 10,
    miscPct: 5
};

/**
 * @desc    Get pricing settings (size multipliers & profit/overhead margins) for the tenant
 * @route   GET /api/tenant/pricing
 * @access  Private
 */
const getTenantPricing = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const settings = tenant.settings || {};
    const pricing = settings.pricing || {};
    const appConfig = settings.appConfig || {};

    let multipliers = pricing.multipliers;
    if (!multipliers && appConfig.ll_multipliers) {
        try {
            multipliers = typeof appConfig.ll_multipliers === 'string'
                ? JSON.parse(appConfig.ll_multipliers)
                : appConfig.ll_multipliers;
        } catch {
            multipliers = DEFAULT_MULTS;
        }
    }
    if (!multipliers || typeof multipliers !== 'object') {
        multipliers = DEFAULT_MULTS;
    }

    const profitPct = pricing.profitPct !== undefined
        ? Number(pricing.profitPct)
        : (appConfig.ll_setting_profitPct !== undefined ? Number(appConfig.ll_setting_profitPct) : DEFAULT_MARGINS.profitPct);

    const overheadPct = pricing.overheadPct !== undefined
        ? Number(pricing.overheadPct)
        : (appConfig.ll_setting_overheadPct !== undefined ? Number(appConfig.ll_setting_overheadPct) : DEFAULT_MARGINS.overheadPct);

    const accessoryPct = pricing.accessoryPct !== undefined
        ? Number(pricing.accessoryPct)
        : (appConfig.ll_setting_accessoryPct !== undefined ? Number(appConfig.ll_setting_accessoryPct) : DEFAULT_MARGINS.accessoryPct);

    const miscPct = pricing.miscPct !== undefined
        ? Number(pricing.miscPct)
        : (appConfig.ll_setting_miscPct !== undefined ? Number(appConfig.ll_setting_miscPct) : DEFAULT_MARGINS.miscPct);

    res.json({
        multipliers,
        profitPct,
        overheadPct,
        accessoryPct,
        miscPct
    });
});

/**
 * @desc    Update pricing settings (multipliers & margins) in PostgreSQL
 * @route   PUT /api/tenant/pricing
 * @access  Private (Owner only)
 */
const updateTenantPricing = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { multipliers, profitPct, overheadPct, accessoryPct, miscPct } = req.body;

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const currentSettings = existingTenant.settings || {};
    const currentPricing = currentSettings.pricing || {};
    const currentAppConfig = currentSettings.appConfig || {};

    const updatedMultipliers = multipliers !== undefined
        ? multipliers
        : (currentPricing.multipliers || DEFAULT_MULTS);

    const updatedProfitPct = profitPct !== undefined ? Number(profitPct) : (currentPricing.profitPct !== undefined ? Number(currentPricing.profitPct) : DEFAULT_MARGINS.profitPct);
    const updatedOverheadPct = overheadPct !== undefined ? Number(overheadPct) : (currentPricing.overheadPct !== undefined ? Number(currentPricing.overheadPct) : DEFAULT_MARGINS.overheadPct);
    const updatedAccessoryPct = accessoryPct !== undefined ? Number(accessoryPct) : (currentPricing.accessoryPct !== undefined ? Number(currentPricing.accessoryPct) : DEFAULT_MARGINS.accessoryPct);
    const updatedMiscPct = miscPct !== undefined ? Number(miscPct) : (currentPricing.miscPct !== undefined ? Number(currentPricing.miscPct) : DEFAULT_MARGINS.miscPct);

    const newPricing = {
        multipliers: updatedMultipliers,
        profitPct: updatedProfitPct,
        overheadPct: updatedOverheadPct,
        accessoryPct: updatedAccessoryPct,
        miscPct: updatedMiscPct
    };

    const newAppConfig = {
        ...currentAppConfig,
        ll_multipliers: updatedMultipliers,
        ll_setting_profitPct: updatedProfitPct,
        ll_setting_overheadPct: updatedOverheadPct,
        ll_setting_accessoryPct: updatedAccessoryPct,
        ll_setting_miscPct: updatedMiscPct
    };

    const mergedSettings = {
        ...currentSettings,
        pricing: newPricing,
        appConfig: newAppConfig
    };

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: mergedSettings }
    });

    res.json(newPricing);
});

/**
 * @desc    Reset pricing settings to defaults in PostgreSQL
 * @route   POST /api/tenant/pricing/reset
 * @access  Private (Owner only)
 */
const resetTenantPricing = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const currentSettings = existingTenant.settings || {};
    const currentAppConfig = currentSettings.appConfig || {};

    const defaultPricing = {
        multipliers: DEFAULT_MULTS,
        ...DEFAULT_MARGINS
    };

    const newAppConfig = {
        ...currentAppConfig,
        ll_multipliers: DEFAULT_MULTS,
        ll_setting_profitPct: DEFAULT_MARGINS.profitPct,
        ll_setting_overheadPct: DEFAULT_MARGINS.overheadPct,
        ll_setting_accessoryPct: DEFAULT_MARGINS.accessoryPct,
        ll_setting_miscPct: DEFAULT_MARGINS.miscPct
    };

    const mergedSettings = {
        ...currentSettings,
        pricing: defaultPricing,
        appConfig: newAppConfig
    };

    await prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: mergedSettings }
    });

    res.json(defaultPricing);
});

/**
 * @desc    Permanently delete tenant account and ALL associated records from database
 * @route   DELETE /api/tenant/account
 * @access  Private (Owner only)
 */
const deleteTenantAccount = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
        res.status(400);
        throw new Error('Tenant ID not found on user');
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });

    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    await prisma.$transaction(async (tx) => {
        // 1. Delete payments & dependent payment records
        const tenantPayments = await tx.payment.findMany({
            where: { tenantId },
            select: { id: true }
        });
        const paymentIds = tenantPayments.map(p => p.id);

        if (paymentIds.length > 0) {
            await tx.paymentAuditEvent.deleteMany({
                where: { paymentId: { in: paymentIds } }
            });
            await tx.paymentRefund.deleteMany({
                where: { paymentId: { in: paymentIds } }
            });
            await tx.paymentAttempt.deleteMany({
                where: { paymentId: { in: paymentIds } }
            });
            await tx.payment.deleteMany({
                where: { id: { in: paymentIds } }
            });
        }

        // 2. Unlink purchases before deleting inventory items
        await tx.purchase.updateMany({
            where: { tenantId, itemId: { not: null } },
            data: { itemId: null }
        });

        // 3. Delete purchases
        await tx.purchase.deleteMany({ where: { tenantId } });

        // 4. Delete inventory history
        await tx.inventoryHistory.deleteMany({ where: { tenantId } });

        // 5. Delete recipe ingredients
        await tx.recipeIngredient.deleteMany({
            where: { recipe: { tenantId } }
        });

        // 6. Delete invoices first (which reference orders)
        await tx.invoice.deleteMany({ where: { tenantId } });

        // 7. Delete order payments & order items
        await tx.orderPayment.deleteMany({
            where: { order: { tenantId } }
        });
        await tx.orderItem.deleteMany({
            where: { order: { tenantId } }
        });

        // 8. Delete orders
        await tx.order.deleteMany({ where: { tenantId } });

        // 9. Delete recipes
        await tx.recipe.deleteMany({ where: { tenantId } });

        // 10. Delete opening stock
        await tx.openingStock.deleteMany({ where: { tenantId } });

        // 11. Delete packaging and decorations
        await tx.packaging.deleteMany({ where: { tenantId } });
        await tx.decoration.deleteMany({ where: { tenantId } });

        // 12. Delete expenses, transactions, and token transactions
        await tx.expense.deleteMany({ where: { tenantId } });
        await tx.transaction.deleteMany({ where: { tenantId } });
        await tx.tokenTransaction.deleteMany({ where: { tenantId } });

        // 13. Delete inventory items
        await tx.inventoryItem.deleteMany({ where: { tenantId } });

        // 14. Delete clients
        await tx.client.deleteMany({ where: { tenantId } });

        // 15. Delete users belonging to this tenant
        await tx.user.deleteMany({ where: { tenantId } });

        // 16. Finally, permanently delete the Tenant record itself
        await tx.tenant.delete({ where: { id: tenantId } });
    }, { maxWait: 15000, timeout: 60000 });

    // Invalidate user cache
    if (req.user && req.user.id) {
        clearUserCache(req.user.id);
    }

    res.json({
        success: true,
        message: 'Tenant account and all associated data permanently deleted from database'
    });
});

module.exports = {
    getTenantDetails,
    updateTenantDetails,
    clearAllTenantData,
    deleteTenantAccount,
    getTenantBootstrap,
    getTenantPricing,
    updateTenantPricing,
    resetTenantPricing
};


