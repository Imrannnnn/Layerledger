const prisma = require('../prisma');

/**
 * @desc    Get all expenses for the tenant
 * @route   GET /api/expenses
 * @access  Private (Owner only)
 */
const getExpenses = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const expenses = await prisma.expense.findMany({
            where: { tenantId },
            orderBy: { date: 'desc' }
        });
        res.json(expenses);
    } catch (error) {
        console.error("Error in getExpenses:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new expense
 * @route   POST /api/expenses
 * @access  Private (Owner only)
 */
const createExpense = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, amount, category, description, receiptUrl } = req.body;

        if (amount === undefined || typeof amount !== 'number' || amount < 0) {
            return res.status(400).json({ message: 'Valid non-negative amount is required' });
        }
        if (!category || typeof category !== 'string' || category.trim() === '') {
            return res.status(400).json({ message: 'Category is required' });
        }

        const expense = await prisma.expense.create({
            data: {
                tenantId,
                date: date ? new Date(date) : new Date(),
                amount,
                category,
                description,
                receiptUrl
            }
        });
        res.status(201).json(expense);
    } catch (error) {
        console.error("Error in createExpense:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update an expense
 * @route   PUT /api/expenses/:id
 * @access  Private (Owner only)
 */
const updateExpense = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { date, amount, category, description, receiptUrl } = req.body;

        if (amount !== undefined && (typeof amount !== 'number' || amount < 0)) {
            return res.status(400).json({ message: 'Amount must be a non-negative number' });
        }
        if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
            return res.status(400).json({ message: 'Category cannot be empty' });
        }

        const updatedExpense = await prisma.expense.updateMany({
            where: { id: req.params.id, tenantId },
            data: {
                date: date ? new Date(date) : undefined,
                amount,
                category,
                description,
                receiptUrl
            }
        });

        if (updatedExpense.count === 0) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        
        const expense = await prisma.expense.findFirst({
            where: { id: req.params.id, tenantId }
        });
        res.json(expense);
    } catch (error) {
        console.error("Error in updateExpense:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete an expense
 * @route   DELETE /api/expenses/:id
 * @access  Private (Owner only)
 */
const deleteExpense = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const deletedExpense = await prisma.expense.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedExpense.count === 0) {
            return res.status(404).json({ message: 'Expense not found' });
        }
        res.json({ message: 'Expense removed successfully' });
    } catch (error) {
        console.error("Error in deleteExpense:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};
