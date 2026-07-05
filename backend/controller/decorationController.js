const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all decorations for the tenant
 * @route   GET /api/decorations
 * @access  Private
 */
const getDecorations = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const decorations = await prisma.decoration.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(decorations);
});

/**
 * @desc    Get a specific decoration by ID
 * @route   GET /api/decorations/:id
 * @access  Private
 */
const getDecorationById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const item = await prisma.decoration.findFirst({
        where: { id: req.params.id, tenantId }
    });
    
    if (!item) {
        res.status(404);
        throw new Error('Decoration not found');
    }
    res.json(item);
});

/**
 * @desc    Create a new decoration item
 * @route   POST /api/decorations
 * @access  Private
 */
const createDecoration = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, price, stock, minStock } = req.body;

    const parsedPrice = parseFloat(price);
    const parsedStock = stock !== undefined ? parseFloat(stock) : 0;
    const parsedMinStock = minStock !== undefined ? parseFloat(minStock) : 0;

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
});

/**
 * @desc    Update a decoration item
 * @route   PUT /api/decorations/:id
 * @access  Private
 */
const updateDecoration = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, price, stock, minStock } = req.body;

    let parsedPrice = price !== undefined ? parseFloat(price) : undefined;
    let parsedStock = stock !== undefined ? parseFloat(stock) : undefined;
    let parsedMinStock = minStock !== undefined ? parseFloat(minStock) : undefined;

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
        res.status(404);
        throw new Error('Decoration not found');
    }
    
    const item = await prisma.decoration.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(item);
});

/**
 * @desc    Delete a decoration item
 * @route   DELETE /api/decorations/:id
 * @access  Private
 */
const deleteDecoration = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deleted = await prisma.decoration.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deleted.count === 0) {
        res.status(404);
        throw new Error('Decoration not found');
    }
    res.json({ message: 'Decoration removed successfully' });
});

module.exports = {
    getDecorations,
    getDecorationById,
    createDecoration,
    updateDecoration,
    deleteDecoration
};
