const prisma = require('../prisma');

/**
 * @desc    Get all transactions for the tenant
 * @route   GET /api/transactions
 * @access  Private (Owner only)
 */
const getTransactions = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const transactions = await prisma.transaction.findMany({
            where: { tenantId },
            orderBy: { date: 'desc' }
        });
        res.json(transactions);
    } catch (error) {
        console.error("Error in getTransactions:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new transaction
 * @route   POST /api/transactions
 * @access  Private (Owner only)
 */
const createTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, description, amount, type, category, reference } = req.body;

        if (!description || typeof description !== 'string' || description.trim() === '') {
            return res.status(400).json({ message: 'Description is required' });
        }
        if (amount === undefined || typeof amount !== 'number' || amount < 0) {
            return res.status(400).json({ message: 'Valid non-negative amount is required' });
        }
        if (!type || typeof type !== 'string' || type.trim() === '') {
            return res.status(400).json({ message: 'Type is required' });
        }

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
    } catch (error) {
        console.error("Error in createTransaction:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a transaction
 * @route   PUT /api/transactions/:id
 * @access  Private (Owner only)
 */
const updateTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, description, amount, type, category, reference } = req.body;

        if (description !== undefined && (typeof description !== 'string' || description.trim() === '')) {
            return res.status(400).json({ message: 'Description cannot be empty' });
        }
        if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
            return res.status(400).json({ message: 'Amount must be a non-negative number' });
        }
        if (type !== undefined && (typeof type !== 'string' || type.trim() === '')) {
            return res.status(400).json({ message: 'Type cannot be empty' });
        }

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
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        const transaction = await prisma.transaction.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(transaction);
    } catch (error) {
        console.error("Error in updateTransaction:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private (Owner only)
 */
const deleteTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deletedTransaction = await prisma.transaction.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedTransaction.count === 0) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        res.json({ message: 'Transaction removed successfully' });
    } catch (error) {
        console.error("Error in deleteTransaction:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction
};
