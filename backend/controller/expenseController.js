const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const purchaseRoutingService = require('../modules/accounting/services/purchaseRouting.service');

/**
 * @desc    Get all expenses for the tenant
 * @route   GET /api/expenses
 * @access  Private (Owner only)
 */
const getExpenses = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { page, limit } = req.query;

    if (page || limit) {
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.max(1, parseInt(limit) || 25);
        const skip = (pageNum - 1) * limitNum;

        const [expenses, total] = await Promise.all([
            prisma.expense.findMany({
                where: { tenantId },
                skip,
                take: limitNum,
                orderBy: { date: 'desc' }
            }),
            prisma.expense.count({ where: { tenantId } })
        ]);

        return res.json({
            data: expenses,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
        });
    }

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
    const { date, amount, category, description, receiptUrl, accountCode, paymentMethod } = req.body;

    const parsedAmount = parseFloat(amount) || 0;

    const result = await prisma.$transaction(async (tx) => {
        const expense = await tx.expense.create({
            data: {
                id: req.body.id || undefined,
                tenantId,
                date: date ? new Date(date) : new Date(),
                amount: parsedAmount,
                category,
                description,
                receiptUrl,
                accountCode: accountCode || undefined
            }
        });

        await purchaseRoutingService.recordExpenseAccounting(tenantId, expense, {
            accountCode,
            paymentMethod
        }, tx);

        return expense;
    }, { maxWait: 10000, timeout: 30000 });

    res.status(201).json(result);
});

/**
 * @desc    Update an expense
 * @route   PUT /api/expenses/:id
 * @access  Private (Owner only)
 */
const updateExpense = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { date, amount, category, description, receiptUrl, accountCode, paymentMethod } = req.body;

    const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.expense.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404);
            throw new Error('Expense not found');
        }

        // Clean up previous accounting entry
        await purchaseRoutingService.handleExpenseCleanup(tenantId, req.params.id, 'Expense updated', req.user?.id, tx);

        const updatedExpense = await tx.expense.update({
            where: { id: req.params.id },
            data: {
                date: date ? new Date(date) : undefined,
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                category,
                description,
                receiptUrl,
                accountCode: accountCode || undefined
            }
        });

        // Re-post updated expense to ledger
        await purchaseRoutingService.recordExpenseAccounting(tenantId, updatedExpense, {
            accountCode: accountCode || updatedExpense.accountCode,
            paymentMethod
        }, tx);

        return updatedExpense;
    }, { maxWait: 10000, timeout: 30000 });

    res.json(result);
});

/**
 * @desc    Delete an expense
 * @route   DELETE /api/expenses/:id
 * @access  Private (Owner only)
 */
const deleteExpense = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    await prisma.$transaction(async (tx) => {
        const existing = await tx.expense.findFirst({
            where: { id: req.params.id, tenantId }
        });

        if (!existing) {
            res.status(404);
            throw new Error('Expense not found');
        }

        // Clean up accounting entry
        await purchaseRoutingService.handleExpenseCleanup(tenantId, req.params.id, 'Expense deleted', req.user?.id, tx);
        await tx.expense.delete({ where: { id: req.params.id } });
    }, { maxWait: 10000, timeout: 30000 });

    res.json({ message: 'Expense removed successfully' });
});

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense
};
