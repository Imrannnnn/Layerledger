const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all stock purchases for the tenant
 * @route   GET /api/purchases
 * @access  Private
 */
const getPurchases = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { page, limit, month } = req.query;

    const where = { tenantId };
    const monthStr = month ? month.trim() : '';
    if (monthStr && monthStr !== 'all' && /^\d{4}-\d{2}$/.test(monthStr)) {
        const startOfMonth = new Date(`${monthStr}-01T00:00:00.000Z`);
        const [y, m] = monthStr.split('-').map(Number);
        const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
        const endOfMonth = new Date(`${nextMonth}-01T00:00:00.000Z`);
        where.date = {
            gte: startOfMonth,
            lt: endOfMonth
        };
    }

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const skip = (pageNum - 1) * limitNum;

        const [purchases, total, agg, allDates] = await Promise.all([
            prisma.purchase.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { date: 'desc' },
                include: { inventoryItem: true }
            }),
            prisma.purchase.count({ where }),
            prisma.purchase.aggregate({
                where,
                _sum: { amount: true }
            }),
            prisma.purchase.findMany({
                where: { tenantId },
                select: { date: true },
                orderBy: { date: 'desc' }
            })
        ]);

        const availableMonths = [...new Set(
            allDates.map(d => (d.date ? d.date.toISOString().slice(0, 7) : null)).filter(Boolean)
        )];

        return res.json({
            data: purchases,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            },
            stats: {
                totalSpent: agg._sum?.amount || 0,
                totalPurchases: total,
                availableMonths
            }
        });
    }

    const purchases = await prisma.purchase.findMany({
        where,
        orderBy: { date: 'desc' },
        include: { inventoryItem: true }
    });
    res.json(purchases);
});

/**
 * @desc    Get a specific purchase by ID
 * @route   GET /api/purchases/:id
 * @access  Private
 */
const getPurchaseById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const purchase = await prisma.purchase.findFirst({
        where: { id: req.params.id, tenantId }
    });
    
    if (!purchase) {
        res.status(404);
        throw new Error('Purchase not found');
    }
    res.json(purchase);
});

/**
 * @desc    Create a new purchase
 * @route   POST /api/purchases
 * @access  Private
 */
const createPurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, supplier, amount, receiptUrl, notes, itemId, unitSize, qty, price, total, cpu, stockAdded } = req.body;

    const parsedAmount = parseFloat(amount) || 0;

    const result = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
            data: {
                id: req.body.id || undefined,
                tenantId,
                date: date ? new Date(date) : undefined,
                supplier,
                amount: parsedAmount,
                receiptUrl,
                notes,
                itemId: itemId || null,
                unitSize: unitSize ? parseFloat(unitSize) : null,
                qty: qty ? parseFloat(qty) : null,
                price: price ? parseFloat(price) : null,
                total: total ? parseFloat(total) : null,
                cpu: cpu ? parseFloat(cpu) : null,
                stockAdded: stockAdded ? parseFloat(stockAdded) : null
            }
        });

        if (itemId && stockAdded && cpu) {
            const parsedStockAdded = parseFloat(stockAdded);
            const parsedCpu = parseFloat(cpu);
            const purchaseValue = parsedStockAdded * parsedCpu;

            const invItem = await tx.inventoryItem.findFirst({
                where: { id: itemId, tenantId }
            });

            if (invItem) {
                const newQty = invItem.stock + parsedStockAdded;
                const newValue = invItem.totalValueOnHand + purchaseValue;
                const newAvgCost = newQty > 0 ? (newValue / newQty) : invItem.cost;

                await tx.inventoryItem.update({
                    where: { id: itemId },
                    data: {
                        stock: newQty,
                        totalValueOnHand: newValue,
                        cost: newAvgCost
                    }
                });

                await tx.inventoryHistory.create({
                    data: {
                        tenantId,
                        inventoryItemId: itemId,
                        type: 'PURCHASE',
                        qtyDelta: parsedStockAdded,
                        valueDelta: purchaseValue,
                        pricePerUnit: parsedCpu,
                        qtyAfter: newQty,
                        valueAfter: newValue,
                        avgCostAfter: newAvgCost,
                        referenceId: purchase.id,
                        reason: `Purchase logged from ${supplier || 'Market Run'}`
                    }
                });
            }
        }

        return purchase;
    }, { maxWait: 10000, timeout: 30000 });

    res.status(201).json(result);
});

/**
 * @desc    Update a purchase
 * @route   PUT /api/purchases/:id
 * @access  Private
 */
const updatePurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, supplier, amount, receiptUrl, notes } = req.body;

    let parsedAmount = amount !== undefined ? parseFloat(amount) : undefined;

    const updated = await prisma.purchase.updateMany({
        where: { id: req.params.id, tenantId },
        data: {
            date: date ? new Date(date) : undefined,
            supplier,
            amount: parsedAmount,
            receiptUrl,
            notes
        }
    });

    if (updated.count === 0) {
        res.status(404);
        throw new Error('Purchase not found');
    }
    
    const purchase = await prisma.purchase.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(purchase);
});

/**
 * @desc    Delete a purchase
 * @route   DELETE /api/purchases/:id
 * @access  Private
 */
const deletePurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const result = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!purchase) {
            throw new Error('Purchase not found');
        }

        await tx.purchase.delete({
            where: { id: req.params.id }
        });

        if (purchase.itemId && purchase.stockAdded && purchase.cpu) {
            const invItem = await tx.inventoryItem.findFirst({
                where: { id: purchase.itemId, tenantId }
            });

            if (invItem) {
                const stockToReduce = purchase.stockAdded;
                const valueToReduce = purchase.stockAdded * purchase.cpu;

                const newQty = Math.max(0, invItem.stock - stockToReduce);
                const newValue = Math.max(0, invItem.totalValueOnHand - valueToReduce);
                const newAvgCost = newQty > 0 ? (newValue / newQty) : invItem.cost;

                await tx.inventoryItem.update({
                    where: { id: purchase.itemId },
                    data: {
                        stock: newQty,
                        totalValueOnHand: newQty === 0 ? 0 : newValue,
                        cost: newAvgCost
                    }
                });

                await tx.inventoryHistory.create({
                    data: {
                        tenantId,
                        inventoryItemId: purchase.itemId,
                        type: 'ADJUSTMENT',
                        qtyDelta: -stockToReduce,
                        valueDelta: -valueToReduce,
                        pricePerUnit: purchase.cpu,
                        qtyAfter: newQty,
                        valueAfter: newQty === 0 ? 0 : newValue,
                        avgCostAfter: newAvgCost,
                        reason: `DELETION: Cancelled Purchase ${purchase.id}`
                    }
                });
            }
        }

        return { message: 'Purchase removed successfully' };
    });

    res.json(result);
});

/**
 * @desc    Delete all purchases for tenant (clear purchase history log)
 * @route   DELETE /api/purchases/all
 * @access  Private (Owner only)
 */
const deleteAllPurchases = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const result = await prisma.$transaction(async (tx) => {
        // Unlink itemId from purchases before deletion to avoid foreign key conflicts
        await tx.purchase.updateMany({
            where: { tenantId, itemId: { not: null } },
            data: { itemId: null }
        });

        const deleted = await tx.purchase.deleteMany({
            where: { tenantId }
        });

        return deleted;
    }, { maxWait: 10000, timeout: 30000 });

    res.json({ message: 'All purchase records deleted successfully', count: result.count });
});

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase,
    deleteAllPurchases
};
