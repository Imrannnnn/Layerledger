const prisma = require('../prisma');

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error in getOrders:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get order details
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = async (req, res) => {
    try {
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
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order);
    } catch (error) {
        console.error("Error in getOrderById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new order or quote
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes } = req.body;

        if (totalPrice !== undefined && (typeof totalPrice !== 'number' || totalPrice < 0)) {
            return res.status(400).json({ message: 'Total price must be a non-negative number' });
        }
        if (totalCost !== undefined && (typeof totalCost !== 'number' || totalCost < 0)) {
            return res.status(400).json({ message: 'Total cost must be a non-negative number' });
        }
        if (status && typeof status !== 'string') {
            return res.status(400).json({ message: 'Status must be a string' });
        }

        if (items) {
            if (!Array.isArray(items)) {
                return res.status(400).json({ message: 'Items must be an array' });
            }
            for (const item of items) {
                if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
                    return res.status(400).json({ message: 'Each item must have a name' });
                }
                if (item.price !== undefined && (typeof item.price !== 'number' || item.price < 0)) {
                    return res.status(400).json({ message: 'Item price must be a non-negative number' });
                }
                if (item.cost !== undefined && (typeof item.cost !== 'number' || item.cost < 0)) {
                    return res.status(400).json({ message: 'Item cost must be a non-negative number' });
                }
            }
        }

        if (payments) {
            if (!Array.isArray(payments)) {
                return res.status(400).json({ message: 'Payments must be an array' });
            }
            for (const payment of payments) {
                if (payment.amount === undefined || typeof payment.amount !== 'number' || payment.amount < 0) {
                    return res.status(400).json({ message: 'Payment amount must be a non-negative number' });
                }
            }
        }

        const order = await prisma.order.create({
            data: {
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
    } catch (error) {
        console.error("Error in createOrder:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update order details
 * @route   PUT /api/orders/:id
 * @access  Private
 */
const updateOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { clientId, status, dueDate, items, totalPrice, totalCost, payments, notes } = req.body;

        if (totalPrice !== undefined && (typeof totalPrice !== 'number' || totalPrice < 0)) {
            return res.status(400).json({ message: 'Total price must be a non-negative number' });
        }
        if (totalCost !== undefined && (typeof totalCost !== 'number' || totalCost < 0)) {
            return res.status(400).json({ message: 'Total cost must be a non-negative number' });
        }

        const existing = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
        if (!existing) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (items) {
            if (!Array.isArray(items)) {
                return res.status(400).json({ message: 'Items must be an array' });
            }
            for (const item of items) {
                if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
                    return res.status(400).json({ message: 'Each item must have a name' });
                }
            }
        }

        if (payments) {
            if (!Array.isArray(payments)) {
                return res.status(400).json({ message: 'Payments must be an array' });
            }
            for (const payment of payments) {
                if (payment.amount === undefined || typeof payment.amount !== 'number' || payment.amount < 0) {
                    return res.status(400).json({ message: 'Payment amount must be a non-negative number' });
                }
            }
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
    } catch (error) {
        console.error("Error in updateOrder:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete an order
 * @route   DELETE /api/orders/:id
 * @access  Private
 */
const deleteOrder = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        
        const existing = await prisma.order.findFirst({ where: { id: req.params.id, tenantId } });
        if (!existing) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await prisma.order.deleteMany({ where: { id: req.params.id, tenantId } });
        res.json({ message: 'Order removed successfully' });
    } catch (error) {
        console.error("Error in deleteOrder:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder
};
