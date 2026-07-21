const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { status } = req.query;

    const where = { tenantId };
    if (status) {
        where.status = status;
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            client: { select: { name: true, phone: true } }
        },
        orderBy: { orderDate: 'desc' }
    });
    res.json(orders);
});

/**
 * @desc    Get order details
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const order = await prisma.order.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
            client: { select: { name: true, phone: true, email: true, address: true } },
            items: true,
            payments: true
        }
    });
    
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }
    res.json(order);
});

/**
 * @desc    Create a new order or quote
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes, usages } = req.body;

    const result = await prisma.$transaction(async (tx) => {
        let ingredientsDeducted = false;
        if (status === 'confirmed' || status === 'baking') {
            ingredientsDeducted = true;
        }

        const order = await tx.order.create({
            data: {
                id: req.body.id || undefined,
                tenantId,
                clientId,
                status: status || 'quote',
                dueDate: dueDate ? new Date(dueDate) : null,
                totalPrice: totalPrice || 0,
                totalCost: totalCost || 0,
                notes,
                ingredientsDeducted,
                items: {
                    create: items?.map(item => ({
                        recipeId: item.recipeId,
                        name: item.name,
                        size: item.size,
                        shape: item.shape,
                        layers: item.layers,
                        decorations: item.decorations,
                        flavorExtras: item.flavorExtras,
                        price: item.price || 0,
                        cost: item.cost || 0
                    })) || []
                },
                payments: {
                    create: payments?.map(payment => ({
                        amount: payment.amount,
                        date: payment.date ? new Date(payment.date) : new Date(),
                        method: payment.method,
                        type: payment.type || 'full'
                    })) || []
                }
            },
            include: { items: true, payments: true }
        });

        if (ingredientsDeducted && usages && usages.length > 0) {
            for (const use of usages) {
                const invItem = await tx.inventoryItem.findFirst({
                    where: { id: use.itemId, tenantId }
                });
                if (!invItem) {
                    throw new Error(`Inventory item not found for usage: ${use.itemId}`);
                }

                if (invItem.stock - use.qty < 0) {
                    throw new Error(`Insufficient stock for ${invItem.name}. Attempted to use ${use.qty} but only ${invItem.stock} is on hand.`);
                }

                const consumedValue = use.qty * invItem.cost;
                const newQty = invItem.stock - use.qty;
                const newValue = Math.max(0, invItem.totalValueOnHand - consumedValue);
                const finalValue = newQty === 0 ? 0 : newValue;
                const newAvgCost = invItem.cost;

                await tx.inventoryItem.update({
                    where: { id: use.itemId },
                    data: {
                        stock: newQty,
                        totalValueOnHand: finalValue,
                        cost: newAvgCost
                    }
                });

                await tx.inventoryHistory.create({
                    data: {
                        tenantId,
                        inventoryItemId: use.itemId,
                        type: 'USAGE',
                        qtyDelta: -use.qty,
                        valueDelta: -consumedValue,
                        pricePerUnit: invItem.cost,
                        qtyAfter: newQty,
                        valueAfter: finalValue,
                        avgCostAfter: newAvgCost,
                        referenceId: order.id,
                        reason: `Baking / production consumption for Order ${order.id}`
                    }
                });
            }
        }

        return order;
    }, { maxWait: 10000, timeout: 30000 });

    res.status(201).json(result);
});

/**
 * @desc    Update order details
 * @route   PUT /api/orders/:id
 * @access  Private
 */
const updateOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes, usages } = req.body;

    const existing = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
        res.status(404);
        throw new Error('Order not found');
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
        let ingredientsDeducted = existing.ingredientsDeducted;
        let shouldDeduct = false;
        let shouldRestore = false;

        if ((status === 'confirmed' || status === 'baking') && !existing.ingredientsDeducted) {
            shouldDeduct = true;
            ingredientsDeducted = true;
        } else if (existing.ingredientsDeducted && status && status !== 'confirmed' && status !== 'baking') {
            shouldRestore = true;
            ingredientsDeducted = false;
        }

        if (shouldDeduct && usages && usages.length > 0) {
            for (const use of usages) {
                const invItem = await tx.inventoryItem.findFirst({
                    where: { id: use.itemId, tenantId }
                });
                if (!invItem) {
                    throw new Error(`Inventory item not found for usage: ${use.itemId}`);
                }

                if (invItem.stock - use.qty < 0) {
                    throw new Error(`Insufficient stock for ${invItem.name}. Attempted to use ${use.qty} but only ${invItem.stock} is on hand.`);
                }

                const consumedValue = use.qty * invItem.cost;
                const newQty = invItem.stock - use.qty;
                const newValue = Math.max(0, invItem.totalValueOnHand - consumedValue);
                const finalValue = newQty === 0 ? 0 : newValue;
                const newAvgCost = invItem.cost;

                await tx.inventoryItem.update({
                    where: { id: use.itemId },
                    data: {
                        stock: newQty,
                        totalValueOnHand: finalValue,
                        cost: newAvgCost
                    }
                });

                await tx.inventoryHistory.create({
                    data: {
                        tenantId,
                        inventoryItemId: use.itemId,
                        type: 'USAGE',
                        qtyDelta: -use.qty,
                        valueDelta: -consumedValue,
                        pricePerUnit: invItem.cost,
                        qtyAfter: newQty,
                        valueAfter: finalValue,
                        avgCostAfter: newAvgCost,
                        referenceId: req.params.id,
                        reason: `Baking / production consumption for Order ${req.params.id}`
                    }
                });
            }
        }

        if (shouldRestore) {
            const usageHistory = await tx.inventoryHistory.findMany({
                where: { referenceId: req.params.id, type: 'USAGE', tenantId }
            });

            for (const record of usageHistory) {
                const invItem = await tx.inventoryItem.findFirst({
                    where: { id: record.inventoryItemId, tenantId }
                });

                if (invItem) {
                    const restoredQty = -record.qtyDelta;
                    const restoredValue = -record.valueDelta;

                    const newQty = invItem.stock + restoredQty;
                    const newValue = invItem.totalValueOnHand + restoredValue;
                    const newAvgCost = newQty > 0 ? (newValue / newQty) : invItem.cost;

                    await tx.inventoryItem.update({
                        where: { id: record.inventoryItemId },
                        data: {
                            stock: newQty,
                            totalValueOnHand: newValue,
                            cost: newAvgCost
                        }
                    });

                    await tx.inventoryHistory.create({
                        data: {
                            tenantId,
                            inventoryItemId: record.inventoryItemId,
                            type: 'ADJUSTMENT',
                            qtyDelta: restoredQty,
                            valueDelta: restoredValue,
                            pricePerUnit: record.pricePerUnit,
                            qtyAfter: newQty,
                            valueAfter: newValue,
                            avgCostAfter: newAvgCost,
                            reason: `RESTORATION: Order status changed from confirmed to ${status} for Order ${req.params.id}`
                        }
                    });
                }
            }

            await tx.inventoryHistory.deleteMany({
                where: { referenceId: req.params.id, type: 'USAGE', tenantId }
            });
        }

        await tx.orderItem.deleteMany({ where: { orderId: req.params.id } });
        await tx.orderPayment.deleteMany({ where: { orderId: req.params.id } });

        const updateData = {
            clientId,
            status,
            dueDate: dueDate ? new Date(dueDate) : null,
            totalPrice,
            totalCost,
            notes,
            ingredientsDeducted
        };

        if (items) {
            updateData.items = {
                create: items.map(item => ({
                    recipeId: item.recipeId,
                    name: item.name,
                    size: item.size,
                    shape: item.shape,
                    layers: item.layers,
                    decorations: item.decorations,
                    flavorExtras: item.flavorExtras,
                    price: item.price || 0,
                    cost: item.cost || 0
                }))
            };
        }

        if (payments) {
            updateData.payments = {
                create: payments.map(payment => ({
                    amount: payment.amount,
                    date: payment.date ? new Date(payment.date) : new Date(),
                    method: payment.method,
                    type: payment.type || 'full'
                }))
            };
        }

        return tx.order.update({
            where: { id: req.params.id },
            data: updateData,
            include: { client: { select: { name: true, phone: true } }, items: true, payments: true }
        });
    }, { timeout: 30000 });

    res.json(updatedOrder);
});

/**
 * @desc    Delete an order
 * @route   DELETE /api/orders/:id
 * @access  Private
 */
const deleteOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    
    const existing = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
        res.status(404);
        throw new Error('Order not found');
    }

    await prisma.order.deleteMany({ where: { id: req.params.id, tenantId } });
    res.json({ message: 'Order removed successfully' });
});

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder
};
