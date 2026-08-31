const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

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
            data: items,
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
    res.json(items);
});

/**
 * @desc    Create a new inventory item
 * @route   POST /api/inventory
 * @access  Private
 */
const createItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, category, unit, cost, stock, minStock } = req.body;

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
                minStock: minStock || 0
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
                minStock: minStock !== undefined ? parseInt(minStock) : undefined
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
    const deletedItem = await prisma.inventoryItem.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedItem.count === 0) {
        res.status(404);
        throw new Error('Inventory item not found');
    }
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
    const appConfig = settings.appConfig || settings.localState || {};

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
    if (settings.localState) {
        updatedSettings.localState = cleanedConfig;
    }

    await prisma.$transaction(async (tx) => {
        // Clear opening balance history entries
        await tx.inventoryHistory.deleteMany({
            where: { tenantId, type: 'OPENING_BALANCE' }
        });

        // Update tenant settings directly in DB
        await tx.tenant.update({
            where: { id: tenantId },
            data: { settings: updatedSettings }
        });
    });

    res.json({ message: 'All opening stock records deleted successfully' });
});

module.exports = {
    getInventory,
    createItem,
    updateItem,
    deleteItem,
    adjustItem,
    deleteAllInventory,
    deleteOpeningStock
};

