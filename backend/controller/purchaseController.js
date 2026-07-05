const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all stock purchases for the tenant
 * @route   GET /api/purchases
 * @access  Private
 */
const getPurchases = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const purchases = await prisma.purchase.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' }
    });
    res.json(purchases);
});

/**
 * @desc    Get a specific purchase by ID
 * @route   GET /api/purchases/:id
 * @access  Private
 */
const getPurchaseById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const purchase = await prisma.purchase.findFirst({
        where: { id: req.params.id, tenantId }
    });
    
    if (!purchase) {
        res.status(404);
        throw new Error('Purchase not found');
    }
    res.json(purchase);
});

/**
 * @desc    Create a new purchase
 * @route   POST /api/purchases
 * @access  Private
 */
const createPurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, supplier, amount, receiptUrl, notes } = req.body;

    const parsedAmount = parseFloat(amount);

    const purchase = await prisma.purchase.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            date: date ? new Date(date) : undefined,
            supplier,
            amount: parsedAmount,
            receiptUrl,
            notes
        }
    });
    res.status(201).json(purchase);
});

/**
 * @desc    Update a purchase
 * @route   PUT /api/purchases/:id
 * @access  Private
 */
const updatePurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, supplier, amount, receiptUrl, notes } = req.body;

    let parsedAmount = amount !== undefined ? parseFloat(amount) : undefined;

    const updated = await prisma.purchase.updateMany({
        where: { id: req.params.id, tenantId },
        data: {
            date: date ? new Date(date) : undefined,
            supplier,
            amount: parsedAmount,
            receiptUrl,
            notes
        }
    });

    if (updated.count === 0) {
        res.status(404);
        throw new Error('Purchase not found');
    }
    
    const purchase = await prisma.purchase.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(purchase);
});

/**
 * @desc    Delete a purchase
 * @route   DELETE /api/purchases/:id
 * @access  Private
 */
const deletePurchase = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deleted = await prisma.purchase.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deleted.count === 0) {
        res.status(404);
        throw new Error('Purchase not found');
    }
    res.json({ message: 'Purchase removed successfully' });
});

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase
};
