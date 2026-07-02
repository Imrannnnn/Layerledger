const prisma = require('../prisma');

/**
 * @desc    Get all decorations for the tenant
 * @route   GET /api/decorations
 * @access  Private
 */
const getDecorations = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const decorations = await prisma.decoration.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(decorations);
    } catch (error) {
        console.error("Error in getDecorations:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a specific decoration by ID
 * @route   GET /api/decorations/:id
 * @access  Private
 */
const getDecorationById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const item = await prisma.decoration.findFirst({
            where: { id: req.params.id, tenantId }
        });
        
        if (!item) {
            return res.status(404).json({ message: 'Decoration not found' });
        }
        res.json(item);
    } catch (error) {
        console.error("Error in getDecorationById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new decoration item
 * @route   POST /api/decorations
 * @access  Private
 */
const createDecoration = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, price, stock, minStock } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Decoration name is required' });
        }
        
        const parsedPrice = parseFloat(price);
        if (price === undefined || isNaN(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: 'Valid non-negative price is required' });
        }

        const parsedStock = stock !== undefined ? parseFloat(stock) : 0;
        const parsedMinStock = minStock !== undefined ? parseFloat(minStock) : 0;

        if (isNaN(parsedStock) || parsedStock < 0 || isNaN(parsedMinStock) || parsedMinStock < 0) {
            return res.status(400).json({ message: 'Stock and minimum stock must be non-negative numbers' });
        }

        const item = await prisma.decoration.create({
            data: {
                tenantId,
                name,
                price: parsedPrice,
                stock: parsedStock,
                minStock: parsedMinStock
            }
        });
        res.status(201).json(item);
    } catch (error) {
        console.error("Error in createDecoration:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a decoration item
 * @route   PUT /api/decorations/:id
 * @access  Private
 */
const updateDecoration = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, price, stock, minStock } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            return res.status(400).json({ message: 'Decoration name cannot be empty' });
        }

        let parsedPrice;
        if (price !== undefined) {
            parsedPrice = parseFloat(price);
            if (isNaN(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ message: 'Price must be a non-negative number' });
            }
        }

        let parsedStock;
        if (stock !== undefined) {
            parsedStock = parseFloat(stock);
            if (isNaN(parsedStock) || parsedStock < 0) {
                return res.status(400).json({ message: 'Stock must be a non-negative number' });
            }
        }

        let parsedMinStock;
        if (minStock !== undefined) {
            parsedMinStock = parseFloat(minStock);
            if (isNaN(parsedMinStock) || parsedMinStock < 0) {
                return res.status(400).json({ message: 'Minimum stock must be a non-negative number' });
            }
        }

        const updated = await prisma.decoration.updateMany({
            where: { id: req.params.id, tenantId },
            data: {
                name,
                price: parsedPrice,
                stock: parsedStock,
                minStock: parsedMinStock
            }
        });

        if (updated.count === 0) {
            return res.status(404).json({ message: 'Decoration not found' });
        }
        
        const item = await prisma.decoration.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(item);
    } catch (error) {
        console.error("Error in updateDecoration:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a decoration item
 * @route   DELETE /api/decorations/:id
 * @access  Private
 */
const deleteDecoration = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deleted = await prisma.decoration.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Decoration not found' });
        }
        res.json({ message: 'Decoration removed successfully' });
    } catch (error) {
        console.error("Error in deleteDecoration:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getDecorations,
    getDecorationById,
    createDecoration,
    updateDecoration,
    deleteDecoration
};
