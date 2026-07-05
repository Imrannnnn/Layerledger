const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get current token balance for the tenant
 * @route   GET /api/tokens/balance
 * @access  Private
 */
const getTokenBalance = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { tokenBalance: true }
    });

    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    res.json({ tokenBalance: tenant.tokenBalance });
});

/**
 * @desc    Get token transaction history for the tenant
 * @route   GET /api/tokens/history
 * @access  Private
 */
const getTokenHistory = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const transactions = await prisma.tokenTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
    });
    res.json(transactions);
});

/**
 * @desc    Create a new token transaction (deduct or top up tokens)
 * @route   POST /api/tokens/transaction
 * @access  Private
 */
const createTokenTransaction = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { amount, type, description } = req.body;

    const parsedAmount = parseFloat(amount);

    // Perform balance check & updates atomically in a Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
        // 1. Fetch current tenant balance
        const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true }
        });

        if (!tenant) {
            res.status(404);
            throw new Error('Tenant not found');
        }

        // 2. Check for sufficient balance if it's a deduction (amount is negative)
        if (parsedAmount < 0 && tenant.tokenBalance + parsedAmount < 0) {
            res.status(400);
            throw new Error('Insufficient token balance');
        }

        // 3. Create the transaction log
        const transaction = await tx.tokenTransaction.create({
            data: {
                tenantId,
                amount: parsedAmount,
                type,
                description
            }
        });

        // 4. Update the Tenant token balance
        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: {
                tokenBalance: {
                    increment: parsedAmount
                }
            },
            select: { tokenBalance: true }
        });

        return { transaction, newBalance: updatedTenant.tokenBalance };
    });

    res.status(201).json(result);
});

module.exports = {
    getTokenBalance,
    getTokenHistory,
    createTokenTransaction
};
