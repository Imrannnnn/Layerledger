const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all inventory items for a tenant
 * @route   GET /api/inventory
 * @access  Private
 */
const getInventory = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const items = await prisma.inventoryItem.findMany({
        where: { tenantId },
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

    const item = await prisma.inventoryItem.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            name,
            category,
            unit,
            cost,
            stock: stock || 0,
            minStock: minStock || 0
        }
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

    const updatedItem = await prisma.inventoryItem.updateMany({
        where: { id: req.params.id, tenantId },
        data: { name, category, unit, cost, stock, minStock }
    });

    if (updatedItem.count === 0) {
        res.status(404);
        throw new Error('Inventory item not found');
    }
    
    const item = await prisma.inventoryItem.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(item);
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

module.exports = {
    getInventory,
    createItem,
    updateItem,
    deleteItem
};
