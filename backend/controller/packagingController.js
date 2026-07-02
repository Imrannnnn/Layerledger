const prisma = require('../prisma');

/**
 * @desc    Get all packaging items for the tenant
 * @route   GET /api/packaging
 * @access  Private
 */
const getPackaging = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const packaging = await prisma.packaging.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(packaging);
    } catch (error) {
        console.error("Error in getPackaging:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a specific packaging item by ID
 * @route   GET /api/packaging/:id
 * @access  Private
 */
const getPackagingById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const item = await prisma.packaging.findFirst({
            where: { id: req.params.id, tenantId }
        });
        
        if (!item) {
            return res.status(404).json({ message: 'Packaging item not found' });
        }
        res.json(item);
    } catch (error) {
        console.error("Error in getPackagingById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new packaging item
 * @route   POST /api/packaging
 * @access  Private
 */
const createPackaging = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, price, stock, minStock } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Packaging name is required' });
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

        const item = await prisma.packaging.create({
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
        console.error("Error in createPackaging:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a packaging item
 * @route   PUT /api/packaging/:id
 * @access  Private
 */
const updatePackaging = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, price, stock, minStock } = req.body;

        if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
            return res.status(400).json({ message: 'Packaging name cannot be empty' });
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

        const updated = await prisma.packaging.updateMany({
            where: { id: req.params.id, tenantId },
            data: {
                name,
                price: parsedPrice,
                stock: parsedStock,
                minStock: parsedMinStock
            }
        });

        if (updated.count === 0) {
            return res.status(404).json({ message: 'Packaging item not found' });
        }
        
        const item = await prisma.packaging.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(item);
    } catch (error) {
        console.error("Error in updatePackaging:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a packaging item
 * @route   DELETE /api/packaging/:id
 * @access  Private
 */
const deletePackaging = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deleted = await prisma.packaging.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Packaging item not found' });
        }
        res.json({ message: 'Packaging item removed successfully' });
    } catch (error) {
        console.error("Error in deletePackaging:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getPackaging,
    getPackagingById,
    createPackaging,
    updatePackaging,
    deletePackaging
};
