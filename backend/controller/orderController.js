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
    const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes } = req.body;

    const order = await prisma.order.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            clientId,
            status: status || 'quote',
            dueDate: dueDate ? new Date(dueDate) : null,
            totalPrice: totalPrice || 0,
            totalCost: totalCost || 0,
            notes,
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
    res.status(201).json(order);
});

/**
 * @desc    Update order details
 * @route   PUT /api/orders/:id
 * @access  Private
 */
const updateOrder = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes } = req.body;

    const existing = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) {
        res.status(404);
        throw new Error('Order not found');
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
        // Delete old sub-records
        await tx.orderItem.deleteMany({ where: { orderId: req.params.id } });
        await tx.orderPayment.deleteMany({ where: { orderId: req.params.id } });

        const updateData = {
            clientId,
            status,
            dueDate: dueDate ? new Date(dueDate) : null,
            totalPrice,
            totalCost,
            notes
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

        // Update order and recreate sub-records
        return tx.order.update({
            where: { id: req.params.id },
            data: updateData,
            include: { client: { select: { name: true, phone: true } }, items: true, payments: true }
        });
    });

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
