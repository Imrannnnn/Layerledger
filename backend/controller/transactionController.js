const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all transactions for the tenant
 * @route   GET /api/transactions
 * @access  Private (Owner only)
 */
const getTransactions = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const transactions = await prisma.transaction.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' }
    });
    res.json(transactions);
});

/**
 * @desc    Create a new transaction
 * @route   POST /api/transactions
 * @access  Private (Owner only)
 */
const createTransaction = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, description, amount, type, category, reference } = req.body;

    const transaction = await prisma.transaction.create({
        data: {
            tenantId,
            date: date ? new Date(date) : new Date(),
            description,
            amount,
            type,
            category,
            reference
        }
    });
    res.status(201).json(transaction);
});

/**
 * @desc    Update a transaction
 * @route   PUT /api/transactions/:id
 * @access  Private (Owner only)
 */
const updateTransaction = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, description, amount, type, category, reference } = req.body;

    const updatedTransaction = await prisma.transaction.updateMany({
        where: { id: req.params.id, tenantId },
        data: {
            date: date ? new Date(date) : undefined,
            description,
            amount,
            type,
            category,
            reference
        }
    });

    if (updatedTransaction.count === 0) {
        res.status(404);
        throw new Error('Transaction not found');
    }
    
    const transaction = await prisma.transaction.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(transaction);
});

/**
 * @desc    Delete a transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private (Owner only)
 */
const deleteTransaction = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deletedTransaction = await prisma.transaction.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedTransaction.count === 0) {
        res.status(404);
        throw new Error('Transaction not found');
    }
    res.json({ message: 'Transaction removed successfully' });
});

module.exports = {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
};
