const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { getEffectivePlan, PLAN_LIMITS } = require('./planController');

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { status, page, limit } = req.query;

    const where = { tenantId };
    if (status) {
        where.status = status;
    }

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const skip = (pageNum - 1) * limitNum;

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: limitNum,
                include: {
                    items: true,
                    payments: true,
                    client: {
                        select: { name: true, phone: true }
                    }
                },
                orderBy: { orderDate: 'desc' }
            }),
            prisma.order.count({ where })
        ]);

        return res.json({
            data: orders,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    }

    const orders = await prisma.order.findMany({
        where,
        include: {
            items: true,
            payments: true,
            client: {
                select: { name: true, phone: true }
            }
        },
        orderBy: { orderDate: 'desc' }
    });
    res.json(orders);
});

/**
 * @desc    Get a single order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const order = await prisma.order.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
            items: true,
            payments: true,
            client: {
                select: { name: true, phone: true }
            }
        }
    });
    
    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }
    res.json(order);
});

/**
 * @desc    Create a new order (with items, payments, and optional client upsert)
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes, usages, metadata } = req.body;

    // Check order limits for Free plan (8 orders/month)
    // NOTE: Quotes (status === 'quote') are pre-order customer estimates and drafts.
    // They must not be blocked by the monthly order limit, and must not count toward the limit.
    const isQuote = (status === 'quote' || req.body.status === 'quote');
    if (!isQuote) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true }
        });
        const effective = getEffectivePlan(tenant);
        const planLimits = PLAN_LIMITS[effective.plan] || PLAN_LIMITS.free;

        if (planLimits.ordersPerMonth !== Infinity) {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthlyOrdersCount = await prisma.order.count({
                where: {
                    tenantId,
                    status: { not: 'quote' },
                    createdAt: { gte: startOfMonth }
                }
            });

            if (monthlyOrdersCount >= planLimits.ordersPerMonth) {
                res.status(403);
                const err = new Error(`Free plan order limit reached (${planLimits.ordersPerMonth} orders per month). Upgrade to Standard (₦5,000/mo) for unlimited orders.`);
                err.code = 'PLAN_LIMIT_REACHED';
                err.limitType = 'ordersPerMonth';
                err.currentCount = monthlyOrdersCount;
                err.limit = planLimits.ordersPerMonth;
                err.plan = effective.plan;
                err.upgradePlan = 'standard';
                err.upgradePrice = 5000;
                throw err;
            }
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        let ingredientsDeducted = false;
        if (status === 'confirmed' || status === 'baking') {
            ingredientsDeducted = true;
        }

        let effectiveClientId = clientId;
        const clientName = req.body.clientName || metadata?.clientName;
        const clientPhone = req.body.clientPhone || metadata?.clientPhone;
        if (!effectiveClientId && clientName && clientName.trim() && !['walk-in', 'gift', 'sample/tasting'].includes(clientName.trim().toLowerCase())) {
            const cleanName = clientName.trim();
            let existingClient = await tx.client.findFirst({
                where: { tenantId, name: { equals: cleanName, mode: 'insensitive' } }
            });
            if (!existingClient) {
                existingClient = await tx.client.create({
                    data: {
                        tenantId,
                        name: cleanName,
                        phone: clientPhone || null,
                        lastOrderDate: new Date()
                    }
                });
            } else {
                await tx.client.update({
                    where: { id: existingClient.id },
                    data: {
                        lastOrderDate: new Date(),
                        phone: clientPhone || existingClient.phone
                    }
                });
            }
            effectiveClientId = existingClient.id;
        } else if (effectiveClientId) {
            await tx.client.updateMany({
                where: { id: effectiveClientId, tenantId },
                data: { lastOrderDate: new Date() }
            });
        }

        const order = await tx.order.create({
            data: {
                id: req.body.id || undefined,
                tenantId,
                clientId: effectiveClientId || undefined,
                status: status || 'quote',
                dueDate: dueDate ? new Date(dueDate) : null,
                totalPrice: totalPrice || 0,
                totalCost: totalCost || 0,
                notes,
                ingredientsDeducted,
                metadata: metadata || {},
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
            const usageMap = new Map();
            for (const use of usages) {
                const itemId = use.itemId;
                const qty = Number(use.qty) || 0;
                if (!itemId || qty <= 0) continue;
                usageMap.set(itemId, (usageMap.get(itemId) || 0) + qty);
            }

            const normalizedUsages = Array.from(usageMap.entries()).map(([itemId, qty]) => ({ itemId, qty }));

            if (normalizedUsages.length > 0) {
                const inventoryItems = await tx.inventoryItem.findMany({
                    where: {
                        tenantId,
                        id: { in: normalizedUsages.map((u) => u.itemId) }
                    }
                });

                const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

                for (const use of normalizedUsages) {
                    const invItem = inventoryMap.get(use.itemId);
                    if (!invItem) {
                        throw new Error(`Inventory item not found for usage: ${use.itemId}`);
                    }
                    if (invItem.stock - use.qty < 0) {
                        throw new Error(`Insufficient stock for ${invItem.name}. Attempted to use ${use.qty} but only ${invItem.stock} is on hand.`);
                    }
                }

                const historyRows = [];

                await Promise.all(
                    normalizedUsages.map(async (use) => {
                        const invItem = inventoryMap.get(use.itemId);
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

                        historyRows.push({
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
                        });
                    })
                );

                if (historyRows.length > 0) {
                    await tx.inventoryHistory.createMany({ data: historyRows });
                }
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
    const {
        clientId,
        status,
        dueDate,
        items,
        totalPrice,
        totalCost,
        payments,
        notes,
        usages,
        metadata
    } = req.body;

    const orderId = req.params.id;

    // ---------------------------------------------------------
    // 1. Get existing order BEFORE opening the transaction
    // ---------------------------------------------------------
    const existing = await prisma.order.findFirst({
        where: {
            id: orderId,
            tenantId
        }
    });

    if (!existing) {
        res.status(404);
        throw new Error('Order not found');
    }

    // ---------------------------------------------------------
    // 2. Determine inventory action
    // ---------------------------------------------------------
    const isProductionStatus =
        status === 'confirmed' || status === 'baking';

    const shouldDeduct =
        isProductionStatus && !existing.ingredientsDeducted;

    const shouldRestore =
        existing.ingredientsDeducted &&
        status &&
        !isProductionStatus;

    const ingredientsDeducted = shouldDeduct
        ? true
        : shouldRestore
            ? false
            : existing.ingredientsDeducted;

    // ---------------------------------------------------------
    // 3. Run the atomic database operation
    // ---------------------------------------------------------
    const updatedOrder = await prisma.$transaction(
        async (tx) => {

            /*
             * =====================================================
             * A. DEDUCT INVENTORY
             * =====================================================
             */

            if (shouldDeduct && usages?.length) {

                // Remove duplicate inventory IDs while preserving
                // their total quantity.
                const usageMap = new Map();

                for (const use of usages) {
                    const itemId = use.itemId;
                    const qty = Number(use.qty) || 0;

                    if (!itemId || qty <= 0) {
                        continue;
                    }

                    usageMap.set(
                        itemId,
                        (usageMap.get(itemId) || 0) + qty
                    );
                }

                const normalizedUsages = Array.from(
                    usageMap.entries()
                ).map(([itemId, qty]) => ({
                    itemId,
                    qty
                }));

                if (normalizedUsages.length) {

                    // ---------------------------------------------
                    // Fetch ALL inventory items in ONE query
                    // ---------------------------------------------
                    const inventoryItems =
                        await tx.inventoryItem.findMany({
                            where: {
                                tenantId,
                                id: {
                                    in: normalizedUsages.map(
                                        (use) => use.itemId
                                    )
                                }
                            }
                        });

                    const inventoryMap = new Map(
                        inventoryItems.map((item) => [
                            item.id,
                            item
                        ])
                    );

                    const historyRows = [];

                    // ---------------------------------------------
                    // Validate everything BEFORE changing stock
                    // ---------------------------------------------
                    for (const use of normalizedUsages) {

                        const invItem =
                            inventoryMap.get(use.itemId);

                        if (!invItem) {
                            throw new Error(
                                `Inventory item not found for usage: ${use.itemId}`
                            );
                        }

                        if (invItem.stock - use.qty < 0) {
                            throw new Error(
                                `Insufficient stock for ${invItem.name}. ` +
                                `Attempted to use ${use.qty} ` +
                                `but only ${invItem.stock} is on hand.`
                            );
                        }
                    }

                    // ---------------------------------------------
                    // Update inventory in parallel
                    // ---------------------------------------------
                    await Promise.all(
                        normalizedUsages.map(async (use) => {
                            const invItem = inventoryMap.get(use.itemId);
                            const consumedValue = use.qty * invItem.cost;
                            const newQty = invItem.stock - use.qty;
                            const newValue = Math.max(
                                0,
                                invItem.totalValueOnHand - consumedValue
                            );
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

                            historyRows.push({
                                tenantId,
                                inventoryItemId: use.itemId,
                                type: 'USAGE',
                                qtyDelta: -use.qty,
                                valueDelta: -consumedValue,
                                pricePerUnit: invItem.cost,
                                qtyAfter: newQty,
                                valueAfter: finalValue,
                                avgCostAfter: newAvgCost,
                                referenceId: orderId,
                                reason: `Baking / production consumption for Order ${orderId}`
                            });
                        })
                    );

                    // ---------------------------------------------
                    // Create ALL history records together
                    // ---------------------------------------------
                    if (historyRows.length) {
                        await tx.inventoryHistory.createMany({
                            data: historyRows
                        });
                    }
                }
            }

            /*
             * =====================================================
             * B. RESTORE INVENTORY
             * =====================================================
             */

            if (shouldRestore) {

                const usageHistory =
                    await tx.inventoryHistory.findMany({
                        where: {
                            referenceId: orderId,
                            type: 'USAGE',
                            tenantId
                        }
                    });

                if (usageHistory.length) {

                    const inventoryIds = [
                        ...new Set(
                            usageHistory.map(
                                (record) =>
                                    record.inventoryItemId
                            )
                        )
                    ];

                    // ---------------------------------------------
                    // Fetch all inventory items in ONE query
                    // ---------------------------------------------
                    const inventoryItems =
                        await tx.inventoryItem.findMany({
                            where: {
                                tenantId,
                                id: {
                                    in: inventoryIds
                                }
                            }
                        });

                    const inventoryMap = new Map(
                        inventoryItems.map((item) => [
                            item.id,
                            item
                        ])
                    );

                    const restorationHistory = [];

                    // ---------------------------------------------
                    // Calculate and apply restoration in parallel
                    // ---------------------------------------------
                    await Promise.all(
                        usageHistory.map(async (record) => {
                            const invItem = inventoryMap.get(record.inventoryItemId);
                            if (!invItem) return;

                            const restoredQty = -record.qtyDelta;
                            const restoredValue = -record.valueDelta;
                            const newQty = invItem.stock + restoredQty;
                            const newValue = invItem.totalValueOnHand + restoredValue;
                            const newAvgCost = newQty > 0 ? newValue / newQty : invItem.cost;

                            await tx.inventoryItem.update({
                                where: { id: record.inventoryItemId },
                                data: {
                                    stock: newQty,
                                    totalValueOnHand: newValue,
                                    cost: newAvgCost
                                }
                            });

                            restorationHistory.push({
                                tenantId,
                                inventoryItemId: record.inventoryItemId,
                                type: 'ADJUSTMENT',
                                qtyDelta: restoredQty,
                                valueDelta: restoredValue,
                                pricePerUnit: record.pricePerUnit,
                                qtyAfter: newQty,
                                valueAfter: newValue,
                                avgCostAfter: newAvgCost,
                                reason: `RESTORATION: Order status changed from confirmed to ${status} for Order ${orderId}`
                            });
                        })
                    );

                    // ---------------------------------------------
                    // Create restoration history together
                    // ---------------------------------------------
                    if (restorationHistory.length) {
                        await tx.inventoryHistory.createMany({
                            data: restorationHistory
                        });
                    }

                    // ---------------------------------------------
                    // Remove original usage records
                    // ---------------------------------------------
                    await tx.inventoryHistory.deleteMany({
                        where: {
                            referenceId: orderId,
                            type: 'USAGE',
                            tenantId
                        }
                    });
                }
            }

            /*
             * =====================================================
             * C. UPDATE ORDER ITEMS & PAYMENTS
             * =====================================================
             */

            await tx.orderItem.deleteMany({
                where: {
                    orderId
                }
            });

            await tx.orderPayment.deleteMany({
                where: {
                    orderId
                }
            });

            const updateData = {
                clientId,
                status,
                dueDate: dueDate
                    ? new Date(dueDate)
                    : null,
                totalPrice,
                totalCost,
                notes,
                ingredientsDeducted,
                metadata: metadata || undefined
            };

            if (items) {
                updateData.items = {
                    create: items.map((item) => ({
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
                    create: payments.map((payment) => ({
                        amount: payment.amount,
                        date: payment.date
                            ? new Date(payment.date)
                            : new Date(),
                        method: payment.method,
                        type: payment.type || 'full'
                    }))
                };
            }

            /*
             * =====================================================
             * D. UPDATE ORDER
             * =====================================================
             */

            return await tx.order.update({
                where: {
                    id: orderId
                },
                data: updateData,
                include: {
                    client: {
                        select: {
                            name: true,
                            phone: true
                        }
                    },
                    items: true,
                    payments: true
                }
            });

        },
        {
            maxWait: 10000,
            timeout: 30000
        }
    );

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

    await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: req.params.id } });
        await tx.orderPayment.deleteMany({ where: { orderId: req.params.id } });
        await tx.invoice.deleteMany({ where: { orderId: req.params.id } });
        await tx.order.deleteMany({ where: { id: req.params.id, tenantId } });
    });
    res.json({ message: 'Order removed successfully' });
});

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder
};