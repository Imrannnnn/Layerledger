const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all packaging items for the tenant
 * @route   GET /api/packaging
 * @access  Private
 */
const getPackaging = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const packaging = await prisma.packaging.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(packaging);
});

/**
 * @desc    Get a specific packaging item by ID
 * @route   GET /api/packaging/:id
 * @access  Private
 */
const getPackagingById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const item = await prisma.packaging.findFirst({
        where: { id: req.params.id, tenantId }
    });
    
    if (!item) {
        res.status(404);
        throw new Error('Packaging item not found');
    }
    res.json(item);
});

/**
 * @desc    Create a new packaging item
 * @route   POST /api/packaging
 * @access  Private
 */
const createPackaging = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, price, stock, minStock } = req.body;

    const parsedPrice = parseFloat(price);
    const parsedStock = stock !== undefined ? parseFloat(stock) : 0;
    const parsedMinStock = minStock !== undefined ? parseFloat(minStock) : 0;

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
});

/**
 * @desc    Update a packaging item
 * @route   PUT /api/packaging/:id
 * @access  Private
 */
const updatePackaging = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, price, stock, minStock } = req.body;

    let parsedPrice = price !== undefined ? parseFloat(price) : undefined;
    let parsedStock = stock !== undefined ? parseFloat(stock) : undefined;
    let parsedMinStock = minStock !== undefined ? parseFloat(minStock) : undefined;

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
        res.status(404);
        throw new Error('Packaging item not found');
    }
    
    const item = await prisma.packaging.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(item);
});

/**
 * @desc    Delete a packaging item
 * @route   DELETE /api/packaging/:id
 * @access  Private
 */
const deletePackaging = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deleted = await prisma.packaging.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deleted.count === 0) {
        res.status(404);
        throw new Error('Packaging item not found');
    }
    res.json({ message: 'Packaging item removed successfully' });
});

module.exports = {
    getPackaging,
    getPackagingById,
    createPackaging,
    updatePackaging,
    deletePackaging
};
