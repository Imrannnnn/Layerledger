const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all expenses for the tenant
 * @route   GET /api/expenses
 * @access  Private (Owner only)
 */
const getExpenses = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const expenses = await prisma.expense.findMany({
        where: { tenantId },
        orderBy: { date: 'desc' }
    });
    res.json(expenses);
});

/**
 * @desc    Create a new expense
 * @route   POST /api/expenses
 * @access  Private (Owner only)
 */
const createExpense = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, amount, category, description, receiptUrl } = req.body;

    const expense = await prisma.expense.create({
        data: {
            id: req.body.id || undefined,
            tenantId,
            date: date ? new Date(date) : new Date(),
            amount,
            category,
            description,
            receiptUrl
        }
    });
    res.status(201).json(expense);
});

/**
 * @desc    Update an expense
 * @route   PUT /api/expenses/:id
 * @access  Private (Owner only)
 */
const updateExpense = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, amount, category, description, receiptUrl } = req.body;

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
        res.status(404);
        throw new Error('Expense not found');
    }
    
    const expense = await prisma.expense.findFirst({
        where: { id: req.params.id, tenantId }
    });
    res.json(expense);
});

/**
 * @desc    Delete an expense
 * @route   DELETE /api/expenses/:id
 * @access  Private (Owner only)
 */
const deleteExpense = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const deletedExpense = await prisma.expense.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedExpense.count === 0) {
        res.status(404);
        throw new Error('Expense not found');
    }
    res.json({ message: 'Expense removed successfully' });
});

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};
