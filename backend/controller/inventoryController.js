const prisma = require('../prisma');

/**
 * @desc    Get all inventory items for a tenant
 * @route   GET /api/inventory
 * @access  Private
 */
const getInventory = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const items = await prisma.inventoryItem.findMany({
            where: { tenantId },
            orderBy: [
                { category: 'asc' },
                { name: 'asc' }
            ]
        });
        res.json(items);
    } catch (error) {
        console.error("Error in getInventory:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new inventory item
 * @route   POST /api/inventory
 * @access  Private
 */
const createItem = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, category, unit, cost, stock, minStock } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Inventory item name is required' });
        }
        if (!category || typeof category !== 'string' || category.trim() === '') {
            return res.status(400).json({ message: 'Category is required' });
        }
        if (!unit || typeof unit !== 'string' || unit.trim() === '') {
            return res.status(400).json({ message: 'Unit is required' });
        }
        if (cost === undefined || typeof cost !== 'number' || cost < 0) {
            return res.status(400).json({ message: 'Valid non-negative cost is required' });
        }
        if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
            return res.status(400).json({ message: 'Stock must be a non-negative number' });
        }
        if (minStock !== undefined && (typeof minStock !== 'number' || minStock < 0)) {
            return res.status(400).json({ message: 'Minimum stock must be a non-negative number' });
        }

        const item = await prisma.inventoryItem.create({
            data: {
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
    } catch (error) {
        console.error("Error in createItem:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update an inventory item
 * @route   PUT /api/inventory/:id
 * @access  Private
 */
const updateItem = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, category, unit, cost, stock, minStock } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            return res.status(400).json({ message: 'Name cannot be empty' });
        }
        if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
            return res.status(400).json({ message: 'Category cannot be empty' });
        }
        if (unit !== undefined && (typeof unit !== 'string' || unit.trim() === '')) {
            return res.status(400).json({ message: 'Unit cannot be empty' });
        }
        if (cost !== undefined && (typeof cost !== 'number' || cost < 0)) {
            return res.status(400).json({ message: 'Cost must be a non-negative number' });
        }
        if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
            return res.status(400).json({ message: 'Stock must be a non-negative number' });
        }
        if (minStock !== undefined && (typeof minStock !== 'number' || minStock < 0)) {
            return res.status(400).json({ message: 'Minimum stock must be a non-negative number' });
        }

        const updatedItem = await prisma.inventoryItem.updateMany({
            where: { id: req.params.id, tenantId },
            data: { name, category, unit, cost, stock, minStock }
        });

        if (updatedItem.count === 0) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        
        const item = await prisma.inventoryItem.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(item);
    } catch (error) {
        console.error("Error in updateItem:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete an inventory item
 * @route   DELETE /api/inventory/:id
 * @access  Private
 */
const deleteItem = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deletedItem = await prisma.inventoryItem.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedItem.count === 0) {
            return res.status(404).json({ message: 'Inventory item not found' });
        }
        res.json({ message: 'Inventory item removed successfully' });
    } catch (error) {
        console.error("Error in deleteItem:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getInventory,
    createItem,
    updateItem,
    deleteItem
};
