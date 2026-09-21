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
    const { date, supplier, amount, receiptUrl, notes, itemId, unitSize, qty, price, total, cpu, stockAdded } = req.body;

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.purchase.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404);
            throw new Error('Purchase not found');
        }

        const newItemId = itemId !== undefined ? (itemId || null) : existing.itemId;
        const newUnitSize = unitSize !== undefined ? (unitSize !== null && unitSize !== '' ? parseFloat(unitSize) : null) : existing.unitSize;
        const newQty = qty !== undefined ? (qty !== null && qty !== '' ? parseFloat(qty) : null) : existing.qty;
        const newPrice = price !== undefined ? (price !== null && price !== '' ? parseFloat(price) : null) : existing.price;
        const newTotal = total !== undefined ? (total !== null && total !== '' ? parseFloat(total) : null) : existing.total;
        const newCpu = cpu !== undefined ? (cpu !== null && cpu !== '' ? parseFloat(cpu) : null) : existing.cpu;
        const newStockAdded = stockAdded !== undefined ? (stockAdded !== null && stockAdded !== '' ? parseFloat(stockAdded) : null) : existing.stockAdded;
        const parsedAmount = amount !== undefined ? parseFloat(amount) : (newTotal !== null && !isNaN(newTotal) ? newTotal : existing.amount);

        const oldItemId = existing.itemId;
        const oldStockAdded = existing.stockAdded ? parseFloat(existing.stockAdded) : 0;
        const oldCpu = existing.cpu ? parseFloat(existing.cpu) : 0;
        const oldValue = oldStockAdded * oldCpu;

        const currentNewStockAdded = newStockAdded ? parseFloat(newStockAdded) : 0;
        const currentNewCpu = newCpu ? parseFloat(newCpu) : 0;
        const currentNewValue = currentNewStockAdded * currentNewCpu;

        if (oldItemId || newItemId) {
            if (oldItemId && newItemId && oldItemId === newItemId) {
                // Same item: apply delta
                const deltaStock = currentNewStockAdded - oldStockAdded;
                const deltaValue = currentNewValue - oldValue;

                if (Math.abs(deltaStock) > 0.0001 || Math.abs(deltaValue) > 0.01) {
                    const invItem = await tx.inventoryItem.findFirst({
                        where: { id: newItemId, tenantId }
                    });

                    if (invItem) {
                        const updatedStock = Math.max(0, parseFloat((invItem.stock + deltaStock).toFixed(3)));
                        const updatedValue = Math.max(0, parseFloat((invItem.totalValueOnHand + deltaValue).toFixed(2)));
                        const updatedAvgCost = updatedStock > 0 ? parseFloat((updatedValue / updatedStock).toFixed(2)) : invItem.cost;

                        await tx.inventoryItem.update({
                            where: { id: newItemId },
                            data: {
                                stock: updatedStock,
                                totalValueOnHand: updatedStock === 0 ? 0 : updatedValue,
                                cost: updatedAvgCost
                            }
                        });

                        await tx.inventoryHistory.create({
                            data: {
                                tenantId,
                                inventoryItemId: newItemId,
                                type: 'ADJUSTMENT',
                                qtyDelta: deltaStock,
                                valueDelta: deltaValue,
                                pricePerUnit: currentNewCpu || invItem.cost,
                                qtyAfter: updatedStock,
                                valueAfter: updatedStock === 0 ? 0 : updatedValue,
                                avgCostAfter: updatedAvgCost,
                                referenceId: existing.id,
                                reason: `EDIT: Purchase ${existing.id} modified`
                            }
                        });
                    }
                }
            } else {
                // Different items: revert from old item, apply to new item
                if (oldItemId && oldStockAdded > 0) {
                    const oldInvItem = await tx.inventoryItem.findFirst({
                        where: { id: oldItemId, tenantId }
                    });
                    if (oldInvItem) {
                        const revertedStock = Math.max(0, parseFloat((oldInvItem.stock - oldStockAdded).toFixed(3)));
                        const revertedValue = Math.max(0, parseFloat((oldInvItem.totalValueOnHand - oldValue).toFixed(2)));
                        const revertedAvgCost = revertedStock > 0 ? parseFloat((revertedValue / revertedStock).toFixed(2)) : oldInvItem.cost;

                        await tx.inventoryItem.update({
                            where: { id: oldItemId },
                            data: {
                                stock: revertedStock,
                                totalValueOnHand: revertedStock === 0 ? 0 : revertedValue,
                                cost: revertedAvgCost
                            }
                        });

                        await tx.inventoryHistory.create({
                            data: {
                                tenantId,
                                inventoryItemId: oldItemId,
                                type: 'ADJUSTMENT',
                                qtyDelta: -oldStockAdded,
                                valueDelta: -oldValue,
                                pricePerUnit: oldCpu || oldInvItem.cost,
                                qtyAfter: revertedStock,
                                valueAfter: revertedStock === 0 ? 0 : revertedValue,
                                avgCostAfter: revertedAvgCost,
                                referenceId: existing.id,
                                reason: `EDIT: Removed from Purchase ${existing.id}`
                            }
                        });
                    }
                }

                if (newItemId && currentNewStockAdded > 0) {
                    const newInvItem = await tx.inventoryItem.findFirst({
                        where: { id: newItemId, tenantId }
                    });
                    if (newInvItem) {
                        const appliedStock = parseFloat((newInvItem.stock + currentNewStockAdded).toFixed(3));
                        const appliedValue = parseFloat((newInvItem.totalValueOnHand + currentNewValue).toFixed(2));
                        const appliedAvgCost = appliedStock > 0 ? parseFloat((appliedValue / appliedStock).toFixed(2)) : newInvItem.cost;

                        await tx.inventoryItem.update({
                            where: { id: newItemId },
                            data: {
                                stock: appliedStock,
                                totalValueOnHand: appliedValue,
                                cost: appliedAvgCost
                            }
                        });

                        await tx.inventoryHistory.create({
                            data: {
                                tenantId,
                                inventoryItemId: newItemId,
                                type: 'PURCHASE',
                                qtyDelta: currentNewStockAdded,
                                valueDelta: currentNewValue,
                                pricePerUnit: currentNewCpu || newInvItem.cost,
                                qtyAfter: appliedStock,
                                valueAfter: appliedValue,
                                avgCostAfter: appliedAvgCost,
                                referenceId: existing.id,
                                reason: `EDIT: Added to Purchase ${existing.id}`
                            }
                        });
                    }
                }
            }
        }

        const updatedPurchase = await tx.purchase.update({
            where: { id: req.params.id },
            data: {
                date: date ? new Date(date) : undefined,
                supplier: supplier !== undefined ? supplier : undefined,
                amount: parsedAmount,
                receiptUrl: receiptUrl !== undefined ? receiptUrl : undefined,
                notes: notes !== undefined ? notes : undefined,
                itemId: newItemId,
                unitSize: newUnitSize,
                qty: newQty,
                price: newPrice,
                total: newTotal,
                cpu: newCpu,
                stockAdded: newStockAdded
            },
            include: { inventoryItem: true }
        });

        return updatedPurchase;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(result);
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
