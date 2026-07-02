const prisma = require('../prisma');

/**
 * @desc    Get all stock purchases for the tenant
 * @route   GET /api/purchases
 * @access  Private
 */
const getPurchases = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const purchases = await prisma.purchase.findMany({
            where: { tenantId },
            orderBy: { date: 'desc' }
        });
        res.json(purchases);
    } catch (error) {
        console.error("Error in getPurchases:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a specific purchase by ID
 * @route   GET /api/purchases/:id
 * @access  Private
 */
const getPurchaseById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const purchase = await prisma.purchase.findFirst({
            where: { id: req.params.id, tenantId }
        });
        
        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }
        res.json(purchase);
    } catch (error) {
        console.error("Error in getPurchaseById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new purchase
 * @route   POST /api/purchases
 * @access  Private
 */
const createPurchase = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, supplier, amount, receiptUrl, notes } = req.body;

        const parsedAmount = parseFloat(amount);
        if (amount === undefined || isNaN(parsedAmount) || parsedAmount < 0) {
            return res.status(400).json({ message: 'Valid non-negative amount is required' });
        }

        const purchase = await prisma.purchase.create({
            data: {
                tenantId,
                date: date ? new Date(date) : undefined,
                supplier,
                amount: parsedAmount,
                receiptUrl,
                notes
            }
        });
        res.status(201).json(purchase);
    } catch (error) {
        console.error("Error in createPurchase:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a purchase
 * @route   PUT /api/purchases/:id
 * @access  Private
 */
const updatePurchase = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, supplier, amount, receiptUrl, notes } = req.body;

        let parsedAmount;
        if (amount !== undefined) {
            parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount < 0) {
                return res.status(400).json({ message: 'Amount must be a non-negative number' });
            }
        }

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
            return res.status(404).json({ message: 'Purchase not found' });
        }
        
        const purchase = await prisma.purchase.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(purchase);
    } catch (error) {
        console.error("Error in updatePurchase:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a purchase
 * @route   DELETE /api/purchases/:id
 * @access  Private
 */
const deletePurchase = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deleted = await prisma.purchase.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Purchase not found' });
        }
        res.json({ message: 'Purchase removed successfully' });
    } catch (error) {
        console.error("Error in deletePurchase:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase
};
