const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { getEffectivePlan, PLAN_LIMITS } = require('./planController');

/**
 * Computes committed stock for all confirmed, undelivered orders
 */
async function getCommittedStockMap(tenantId) {
    try {
        const confirmedOrders = await prisma.order.findMany({
            where: {
                tenantId,
                status: { in: ['confirmed', 'baking', 'ready'] },
                deliveredAt: null
            },
            select: {
                metadata: true
            }
        });

        const committedMap = new Map();
        for (const order of confirmedOrders) {
            const meta = order.metadata || {};
            if (meta.productionSheet?.shoppingList && Array.isArray(meta.productionSheet.shoppingList)) {
                for (const item of meta.productionSheet.shoppingList) {
                    const itemId = item.itemId || item.id;
                    const qty = Number(item.neededGrams || item.quantity || item.qty) || 0;
                    if (itemId && qty > 0) {
                        committedMap.set(itemId, (committedMap.get(itemId) || 0) + qty);
                    }
                }
            } else if (meta.usages && Array.isArray(meta.usages)) {
                for (const item of meta.usages) {
                    const itemId = item.itemId || item.id;
                    const qty = Number(item.qty || item.quantity) || 0;
                    if (itemId && qty > 0) {
                        committedMap.set(itemId, (committedMap.get(itemId) || 0) + qty);
                    }
                }
            }
        }
        return committedMap;
    } catch {
        return new Map();
    }
}

/**
 * @desc    Get all inventory items for a tenant (with optional pagination)
 * @route   GET /api/inventory
 * @access  Private
 */
const getInventory = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { page, limit, search, category } = req.query;

    const where = { tenantId };
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }
    if (category) {
        where.category = category;
    }

    const committedMap = await getCommittedStockMap(tenantId);
    const enrich = (item) => {
        const committed = committedMap.get(item.id) || 0;
        return {
            ...item,
            onHand: item.stock,
            committed: Math.round(committed * 1000) / 1000,
            free: Math.round((item.stock - committed) * 1000) / 1000
        };
    };

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            prisma.inventoryItem.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: [
                    { category: 'asc' },
                    { name: 'asc' }
                ]
            }),
            prisma.inventoryItem.count({ where })
        ]);

        return res.json({
            data: items.map(enrich),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    }

    const items = await prisma.inventoryItem.findMany({
        where,
        orderBy: [
            { category: 'asc' },
            { name: 'asc' }
        ]
    });
    res.json(items.map(enrich));
});

/**
 * @desc    Create a new inventory item
 * @route   POST /api/inventory
 * @access  Private
 */
const createItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, category, unit, cost, stock, minStock } = req.body;

    // Enforce inventory item limits based on plan
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true }
    });
    const effective = getEffectivePlan(tenant);
    const planLimits = PLAN_LIMITS[effective.plan] || PLAN_LIMITS.free;

    if (planLimits.inventoryItems !== Infinity) {
        const currentCount = await prisma.inventoryItem.count({ where: { tenantId } });
        if (currentCount >= planLimits.inventoryItems) {
            res.status(403);
            const err = new Error(`Inventory item limit reached (${planLimits.inventoryItems} items for ${planLimits.name} plan). Upgrade to ${effective.plan === 'free' ? 'Standard (250 items)' : 'Premium (unlimited items)'}.`);
            err.code = 'PLAN_LIMIT_REACHED';
            err.limitType = 'inventoryItems';
            err.currentCount = currentCount;
            err.limit = planLimits.inventoryItems;
            err.plan = effective.plan;
            err.upgradePlan = effective.plan === 'free' ? 'standard' : 'premium';
            err.upgradePrice = effective.plan === 'free' ? 5000 : 10000;
            throw err;
        }
    }

    const parsedCost = parseFloat(cost) || 0;
    const parsedStock = parseFloat(stock) || 0;
    const openingValue = parsedStock * parsedCost;

    const item = await prisma.$transaction(async (tx) => {
        const newItem = await tx.inventoryItem.create({
            data: {
                id: req.body.id || undefined,
                tenantId,
                name,
                category,
                unit,
                cost: parsedCost,
                stock: parsedStock,
                totalValueOnHand: openingValue,
                minStock: minStock !== undefined && !isNaN(parseFloat(minStock)) ? parseFloat(minStock) : 0
            }
        });

        // Record opening balance in history
        await tx.inventoryHistory.create({
            data: {
                tenantId,
                inventoryItemId: newItem.id,
                type: 'OPENING_BALANCE',
                qtyDelta: parsedStock,
                valueDelta: openingValue,
                pricePerUnit: parsedCost,
                qtyAfter: parsedStock,
                valueAfter: openingValue,
                avgCostAfter: parsedCost,
                reason: 'Opening balance setup'
            }
        });

        return newItem;
    });

    res.status(201).json(item);
});

/**
 * @desc    Update an inventory item
 * @route   PUT /api/inventory/:id
 * @access  Private
 */
const updateItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, category, unit, cost, stock, minStock } = req.body;

    const result = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!item) {
            res.status(404);
            throw new Error('Inventory item not found');
        }

        const newStock = stock !== undefined ? parseFloat(stock) : item.stock;
        const newCost = cost !== undefined ? parseFloat(cost) : item.cost;
        const newValue = newStock * newCost;

        const updated = await tx.inventoryItem.update({
            where: { id: req.params.id },
            data: {
                name,
                category,
                unit,
                cost: newCost,
                stock: newStock,
                totalValueOnHand: newValue,
                minStock: minStock !== undefined && !isNaN(parseFloat(minStock)) ? parseFloat(minStock) : undefined
            }
        });

        return updated;
    });

    res.json(result);
});

/**
 * @desc    Delete an inventory item
 * @route   DELETE /api/inventory/:id
 * @access  Private
 */
const deleteItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const itemId = req.params.id;

    await prisma.$transaction(async (tx) => {
        // 1. Unlink any purchase items referencing this item
        await tx.purchase.updateMany({
            where: { tenantId, itemId },
            data: { itemId: null }
        });

        // 2. Delete inventory history for this item
        await tx.inventoryHistory.deleteMany({
            where: { tenantId, inventoryItemId: itemId }
        });

        // 3. Delete recipe ingredients referencing this item
        await tx.recipeIngredient.deleteMany({
            where: { inventoryItemId: itemId }
        });

        // 4. Delete the item
        const deletedItem = await tx.inventoryItem.deleteMany({
            where: { id: itemId, tenantId }
        });

        if (deletedItem.count === 0) {
            res.status(404);
            throw new Error('Inventory item not found');
        }
    });

    res.json({ message: 'Inventory item removed successfully' });
});

/**
 * @desc    Adjust stock or cost of an inventory item (manual correction)
 * @route   POST /api/inventory/:id/adjust
 * @access  Private
 */
const adjustItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { type, qtyAdjustment, newCost, reason } = req.body;

    if (!type || !reason) {
        res.status(400);
        throw new Error('Adjustment type and reason are required');
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!item) {
            throw new Error('Inventory item not found');
        }

        let newQty = item.stock;
        let newValue = item.totalValueOnHand;
        let newAvgCost = item.cost;

        let parsedQtyDelta = 0;
        let parsedValueDelta = 0;

        if (type === 'spoilage' || type === 'spoil') {
            const spoiledQty = parseFloat(qtyAdjustment) || 0;
            if (spoiledQty <= 0) {
                throw new Error('Spoilage quantity must be greater than 0');
            }
            parsedQtyDelta = -spoiledQty;
            parsedValueDelta = -spoiledQty * item.cost;
            newQty = Math.max(0, item.stock - spoiledQty);
            newValue = Math.max(0, item.totalValueOnHand + parsedValueDelta);
        } else if (type === 'count_fix') {
            const targetQty = parseFloat(qtyAdjustment);
            if (isNaN(targetQty) || targetQty < 0) {
                throw new Error('Physical count qty must be a non-negative number');
            }
            parsedQtyDelta = targetQty - item.stock;
            parsedValueDelta = parsedQtyDelta * item.cost;
            newQty = targetQty;
            newValue = Math.max(0, item.totalValueOnHand + parsedValueDelta);
            if (newQty === 0) {
                newValue = 0;
            }
        } else if (type === 'revaluation' || type === 'price_revaluation') {
            const targetCost = parseFloat(newCost);
            if (isNaN(targetCost) || targetCost < 0) {
                throw new Error('New cost per unit must be a non-negative number');
            }
            newAvgCost = targetCost;
            newValue = item.stock * targetCost;
            parsedValueDelta = newValue - item.totalValueOnHand;
            parsedQtyDelta = 0;
        } else {
            throw new Error('Invalid adjustment type. Allowed types: spoilage, count_fix, revaluation');
        }

        if (newQty < 0) {
            throw new Error('Adjustment would result in negative stock count');
        }

        const updated = await tx.inventoryItem.update({
            where: { id: item.id },
            data: {
                stock: newQty,
                totalValueOnHand: newValue,
                cost: newAvgCost
            }
        });

        await tx.inventoryHistory.create({
            data: {
                tenantId,
                inventoryItemId: item.id,
                type: 'ADJUSTMENT',
                qtyDelta: parsedQtyDelta,
                valueDelta: parsedValueDelta,
                pricePerUnit: newAvgCost,
                qtyAfter: newQty,
                valueAfter: newValue,
                avgCostAfter: newAvgCost,
                reason: `${type.toUpperCase()}: ${reason}`
            }
        });

        return updated;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(updatedItem);
});

/**
 * @desc    Delete all inventory items for a tenant directly from database
 * @route   DELETE /api/inventory/all
 * @access  Private (Owner only)
 */
const deleteAllInventory = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const result = await prisma.$transaction(async (tx) => {
        // 1. Unlink any purchase items referencing inventory items so foreign keys don't fail
        await tx.purchase.updateMany({
            where: { tenantId, itemId: { not: null } },
            data: { itemId: null }
        });

        // 1b. Unlink any opening stock items referencing inventory items so foreign keys don't fail
        await tx.openingStock.updateMany({
            where: { tenantId, itemId: { not: null } },
            data: { itemId: null }
        });

        // 2. Delete inventory history
        await tx.inventoryHistory.deleteMany({
            where: { tenantId }
        });

        // 3. Delete recipe ingredients
        await tx.recipeIngredient.deleteMany({
            where: { recipe: { tenantId } }
        });

        // 4. Delete all inventory items
        const deleted = await tx.inventoryItem.deleteMany({
            where: { tenantId }
        });

        return deleted;
    }, { maxWait: 10000, timeout: 30000 });

    res.json({ message: 'All inventory items deleted successfully', count: result.count });
});

/**
 * @desc    Delete all opening stock records directly from database
 * @route   DELETE /api/inventory/opening-stock
 * @access  Private (Owner only)
 */
const deleteOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    const settings = tenant.settings || {};
    const appConfig = settings.appConfig || {};

    // Remove opening stock keys: ll_opening_stock and any ll_os_*
    const cleanedConfig = {};
    for (const [k, v] of Object.entries(appConfig)) {
        if (k !== 'll_opening_stock' && !k.startsWith('ll_os_')) {
            cleanedConfig[k] = v;
        }
    }

    const updatedSettings = {
        ...settings,
        appConfig: cleanedConfig
    };

    await prisma.$transaction(async (tx) => {
        // Clear opening balance history entries
        await tx.inventoryHistory.deleteMany({
            where: { tenantId, type: 'OPENING_BALANCE' }
        });

        // Delete all opening stock records from database table
        await tx.openingStock.deleteMany({
            where: { tenantId }
        });

        // Update tenant settings directly in DB
        await tx.tenant.update({
            where: { id: tenantId },
            data: { settings: updatedSettings }
        });
    });

    res.json({ message: 'All opening stock records deleted successfully' });
});

/**
 * @desc    Batch delete specific inventory items by array of IDs
 * @route   POST /api/inventory/batch-delete
 * @access  Private
 */
const batchDeleteItems = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        res.status(400);
        throw new Error('Please provide an array of item IDs to delete');
    }

    const result = await prisma.$transaction(async (tx) => {
        // 1. Unlink any purchase items referencing these items
        await tx.purchase.updateMany({
            where: { tenantId, itemId: { in: ids } },
            data: { itemId: null }
        });

        // 2. Delete inventory history for these items
        await tx.inventoryHistory.deleteMany({
            where: { tenantId, inventoryItemId: { in: ids } }
        });

        // 3. Delete recipe ingredients referencing these items
        await tx.recipeIngredient.deleteMany({
            where: { inventoryItemId: { in: ids } }
        });

        // 4. Delete the items
        const deleted = await tx.inventoryItem.deleteMany({
            where: { id: { in: ids }, tenantId }
        });

        return deleted;
    }, { maxWait: 10000, timeout: 30000 });

    res.json({ message: 'Selected inventory items deleted successfully', count: result.count });
});

/**
 * @desc    Submit multi-item stock adjustment with reason codes
 * @route   POST /api/inventory/adjustments
 * @access  Private
 */
const batchStockAdjustment = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { reason, date, note, adjustments } = req.body;

    const VALID_REASONS = [
        'Spoilt or expired',
        'Damaged',
        'Used for testing or samples',
        'Theft or loss',
        'Counted wrong',
        'Other'
    ];

    if (!reason || !VALID_REASONS.includes(reason)) {
        res.status(400);
        throw new Error(`Invalid adjustment reason. Must be one of: ${VALID_REASONS.join(', ')}`);
    }

    if (reason === 'Other' && (!note || !note.trim())) {
        res.status(400);
        throw new Error('A note is required when reason is "Other"');
    }

    if (!Array.isArray(adjustments) || adjustments.length === 0) {
        res.status(400);
        throw new Error('Adjustments array is required with at least one item');
    }

    const adjDate = date ? new Date(date) : new Date();

    const results = await prisma.$transaction(async (tx) => {
        const itemIds = adjustments.map(a => a.itemId).filter(Boolean);
        const items = await tx.inventoryItem.findMany({
            where: { id: { in: itemIds }, tenantId }
        });
        const itemMap = new Map(items.map(i => [i.id, i]));

        const historyRows = [];
        const updatedItems = [];

        for (const adj of adjustments) {
            const item = itemMap.get(adj.itemId);
            if (!item) {
                throw new Error(`Inventory item not found: ${adj.itemId}`);
            }

            let delta = Number(adj.qtyDelta);
            if (adj.targetQty !== undefined && adj.targetQty !== null && !isNaN(Number(adj.targetQty))) {
                delta = Number(adj.targetQty) - item.stock;
            }

            if (isNaN(delta) || delta === 0) {
                continue;
            }

            // Direction enforcement:
            // "Counted wrong is the only two-way reason, because a miscount is the only case
            // where real stock can turn out to be higher than the record."
            if (reason !== 'Counted wrong') {
                if (delta > 0) {
                    delta = -delta;
                }
            }

            const newStock = parseFloat((item.stock + delta).toFixed(4));
            const newTotalValue = Math.max(0, parseFloat((newStock * item.cost).toFixed(2)));

            const updated = await tx.inventoryItem.update({
                where: { id: item.id },
                data: {
                    stock: newStock,
                    totalValueOnHand: newTotalValue
                }
            });
            updatedItems.push(updated);

            historyRows.push({
                tenantId,
                inventoryItemId: item.id,
                type: 'ADJUSTMENT',
                date: adjDate,
                qtyDelta: delta,
                valueDelta: parseFloat((delta * item.cost).toFixed(2)),
                pricePerUnit: item.cost,
                qtyAfter: newStock,
                valueAfter: newTotalValue,
                avgCostAfter: item.cost,
                reason,
                note: note || adj.note || null
            });
        }

        if (historyRows.length > 0) {
            await tx.inventoryHistory.createMany({ data: historyRows });
        }

        return updatedItems;
    });

    res.json({ success: true, count: results.length, items: results });
});

module.exports = {
    getInventory,
    createItem,
    updateItem,
    deleteItem,
    adjustItem,
    deleteAllInventory,
    deleteOpeningStock,
    batchDeleteItems,
    batchStockAdjustment
};

