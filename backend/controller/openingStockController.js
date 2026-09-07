const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all opening stock items for the tenant (optionally filtered by month)
 * @route   GET /api/opening-stock
 * @access  Private
 */
const getOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { month, search, page, limit } = req.query;

    const where = { tenantId };
    if (month && month.trim()) {
        where.month = month.trim();
    }
    if (search && search.trim()) {
        where.name = { contains: search.trim(), mode: 'insensitive' };
    }

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            prisma.openingStock.findMany({
                where,
                orderBy: { name: 'asc' },
                skip,
                take: limitNum
            }),
            prisma.openingStock.count({ where })
        ]);

        return res.json({
            items,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    }

    const items = await prisma.openingStock.findMany({
        where,
        orderBy: { name: 'asc' }
    });
    res.json(items);
});

/**
 * @desc    Create a new opening stock item
 * @route   POST /api/opening-stock
 * @access  Private
 */
const createOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { itemId, name, unit, cost, openingQty, month, locked } = req.body;

    if (!name || !name.trim()) {
        res.status(400);
        throw new Error('Item name is required');
    }

    const numCost = parseFloat(cost) || 0;
    const numQty = parseFloat(openingQty) || 0;
    const totalValue = numCost * numQty;
    const trimmedName = name.trim();

    // Opening stock feeds inventory: find existing or create corresponding inventory item
    let linkedItemId = itemId || null;
    let invItem = null;

    if (linkedItemId) {
        invItem = await prisma.inventoryItem.findFirst({
            where: { id: linkedItemId, tenantId }
        });
    }
    if (!invItem) {
        invItem = await prisma.inventoryItem.findFirst({
            where: {
                tenantId,
                name: { equals: trimmedName, mode: 'insensitive' }
            }
        });
    }

    if (invItem) {
        linkedItemId = invItem.id;
        const newCost = numCost > 0 ? numCost : invItem.cost;
        await prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: {
                stock: numQty,
                cost: newCost,
                unit: unit || invItem.unit,
                totalValueOnHand: numQty * newCost
            }
        });
    } else {
        const newInvItem = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: trimmedName,
                category: 'Dry Goods',
                unit: unit || 'kg',
                cost: numCost,
                stock: numQty,
                totalValueOnHand: totalValue,
                minStock: 5
            }
        });
        linkedItemId = newInvItem.id;
    }

    const item = await prisma.openingStock.create({
        data: {
            tenantId,
            itemId: linkedItemId,
            name: trimmedName,
            unit: unit || 'kg',
            cost: numCost,
            openingQty: numQty,
            totalValue,
            month: month || new Date().toISOString().slice(0, 7),
            locked: !!locked
        }
    });

    res.status(201).json(item);
});

/**
 * @desc    Bulk sync / batch upsert opening stock list for a month
 * @route   POST /api/opening-stock/bulk
 * @access  Private
 */
const bulkSyncOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { month, items, locked } = req.body;

    if (!Array.isArray(items)) {
        res.status(400);
        throw new Error('Items array is required');
    }

    const targetMonth = month || new Date().toISOString().slice(0, 7);

    // Fetch existing inventory items for this tenant to feed/link
    const existingInvItems = await prisma.inventoryItem.findMany({
        where: { tenantId }
    });
    const invMapByName = new Map();
    const invMapById = new Map();
    for (const inv of existingInvItems) {
        invMapByName.set(inv.name.trim().toLowerCase(), inv);
        invMapById.set(inv.id, inv);
    }

    await prisma.$transaction(async (tx) => {
        // Clear existing records for this tenant & month
        await tx.openingStock.deleteMany({
            where: { tenantId, month: targetMonth }
        });

        // Insert new opening stock rows and feed to inventory
        if (items.length > 0) {
            const validItems = items.filter(it => it && it.name && it.name.trim());
            const createData = [];

            for (const it of validItems) {
                const numCost = parseFloat(it.cost) || 0;
                const numQty = parseFloat(it.openingQty) || 0;
                const trimmedName = it.name.trim();
                const cleanKey = trimmedName.toLowerCase();

                let invMatch = (it.itemId && invMapById.get(it.itemId)) ||
                    (it.id && invMapById.get(it.id)) ||
                    invMapByName.get(cleanKey);

                let linkedItemId = invMatch ? invMatch.id : null;

                if (invMatch) {
                    const newCost = numCost > 0 ? numCost : invMatch.cost;
                    await tx.inventoryItem.update({
                        where: { id: invMatch.id },
                        data: {
                            stock: numQty,
                            cost: newCost,
                            unit: it.unit || invMatch.unit,
                            totalValueOnHand: numQty * newCost
                        }
                    });
                } else {
                    const newInv = await tx.inventoryItem.create({
                        data: {
                            tenantId,
                            name: trimmedName,
                            category: 'Dry Goods',
                            unit: it.unit || 'kg',
                            cost: numCost,
                            stock: numQty,
                            totalValueOnHand: numCost * numQty,
                            minStock: 5
                        }
                    });
                    linkedItemId = newInv.id;
                    invMapByName.set(cleanKey, newInv);
                    invMapById.set(newInv.id, newInv);
                }

                createData.push({
                    id: it.id && it.id.length >= 10 && !it.id.startsWith('os_') ? it.id : undefined,
                    tenantId,
                    itemId: linkedItemId,
                    name: trimmedName,
                    unit: it.unit || 'kg',
                    cost: numCost,
                    openingQty: numQty,
                    totalValue: numCost * numQty,
                    month: targetMonth,
                    locked: locked !== undefined ? !!locked : (it.locked !== undefined ? !!it.locked : false)
                });
            }

            if (createData.length > 0) {
                await tx.openingStock.createMany({
                    data: createData
                });
            }
        }
    });

    const refreshed = await prisma.openingStock.findMany({
        where: { tenantId, month: targetMonth },
        orderBy: { name: 'asc' }
    });

    res.json(refreshed);
});

/**
 * @desc    Update a specific opening stock entry
 * @route   PUT /api/opening-stock/:id
 * @access  Private
 */
const updateOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { name, unit, cost, openingQty, month, locked } = req.body;

    const existing = await prisma.openingStock.findFirst({
        where: { id, tenantId }
    });

    if (!existing) {
        res.status(404);
        throw new Error('Opening stock item not found');
    }

    const numCost = cost !== undefined ? (parseFloat(cost) || 0) : existing.cost;
    const numQty = openingQty !== undefined ? (parseFloat(openingQty) || 0) : existing.openingQty;
    const totalValue = numCost * numQty;
    const updatedName = name !== undefined ? name.trim() : existing.name;

    // Feed to inventory if openingQty, cost, unit, or name changed
    let invItem = null;
    if (existing.itemId) {
        invItem = await prisma.inventoryItem.findFirst({
            where: { id: existing.itemId, tenantId }
        });
    }
    if (!invItem) {
        invItem = await prisma.inventoryItem.findFirst({
            where: {
                tenantId,
                name: { equals: existing.name.trim(), mode: 'insensitive' }
            }
        });
    }

    let linkedItemId = existing.itemId;
    if (invItem) {
        linkedItemId = invItem.id;
        const newStock = openingQty !== undefined ? numQty : invItem.stock;
        const newCost = cost !== undefined ? numCost : invItem.cost;
        await prisma.inventoryItem.update({
            where: { id: invItem.id },
            data: {
                name: updatedName,
                unit: unit !== undefined ? unit : invItem.unit,
                stock: newStock,
                cost: newCost,
                totalValueOnHand: newStock * newCost
            }
        });
    } else if (openingQty !== undefined || cost !== undefined) {
        const newInv = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name: updatedName,
                category: 'Dry Goods',
                unit: unit !== undefined ? unit : existing.unit,
                cost: numCost,
                stock: numQty,
                totalValueOnHand: totalValue,
                minStock: 5
            }
        });
        linkedItemId = newInv.id;
    }

    const updated = await prisma.openingStock.update({
        where: { id },
        data: {
            itemId: linkedItemId,
            name: updatedName,
            unit: unit !== undefined ? unit : existing.unit,
            cost: numCost,
            openingQty: numQty,
            totalValue,
            month: month !== undefined ? month : existing.month,
            locked: locked !== undefined ? !!locked : existing.locked
        }
    });

    res.json(updated);
});

/**
 * @desc    Delete a single opening stock item
 * @route   DELETE /api/opening-stock/:id
 * @access  Private
 */
const deleteOpeningStockItem = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const deleted = await prisma.openingStock.deleteMany({
        where: { id, tenantId }
    });

    if (deleted.count === 0) {
        res.status(404);
        throw new Error('Opening stock item not found');
    }

    res.json({ message: 'Opening stock item deleted successfully' });
});

/**
 * @desc    Lock or unlock opening stock for a specific month
 * @route   PUT /api/opening-stock/lock
 * @access  Private
 */
const lockMonthOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { month, locked } = req.body;

    if (!month || !month.trim()) {
        res.status(400);
        throw new Error('Month is required');
    }

    const isLocked = locked !== undefined ? !!locked : true;
    const targetMonth = month.trim();

    await prisma.openingStock.updateMany({
        where: { tenantId, month: targetMonth },
        data: { locked: isLocked }
    });

    const items = await prisma.openingStock.findMany({
        where: { tenantId, month: targetMonth },
        orderBy: { name: 'asc' }
    });

    res.json({
        message: `Opening stock for ${targetMonth} ${isLocked ? 'locked' : 'unlocked'} successfully`,
        month: targetMonth,
        locked: isLocked,
        items
    });
});

/**
 * @desc    Delete all opening stock records for the tenant
 * @route   DELETE /api/opening-stock
 * @access  Private (Owner only)
 */
const deleteAllOpeningStock = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { month } = req.query;

    const where = { tenantId };
    if (month && month.trim()) {
        where.month = month.trim();
    }

    const result = await prisma.openingStock.deleteMany({ where });
    res.json({ message: 'Opening stock records deleted successfully', count: result.count });
});

module.exports = {
    getOpeningStock,
    createOpeningStock,
    bulkSyncOpeningStock,
    updateOpeningStock,
    lockMonthOpeningStock,
    deleteOpeningStockItem,
    deleteAllOpeningStock
};

