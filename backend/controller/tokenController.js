const prisma = require('../prisma');

/**
 * @desc    Get current token balance for the tenant
 * @route   GET /api/tokens/balance
 * @access  Private
 */
const getTokenBalance = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true }
        });

        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }

        res.json({ tokenBalance: tenant.tokenBalance });
    } catch (error) {
        console.error("Error in getTokenBalance:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get token transaction history for the tenant
 * @route   GET /api/tokens/history
 * @access  Private
 */
const getTokenHistory = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const transactions = await prisma.tokenTransaction.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(transactions);
    } catch (error) {
        console.error("Error in getTokenHistory:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new token transaction (deduct or top up tokens)
 * @route   POST /api/tokens/transaction
 * @access  Private
 */
const createTokenTransaction = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { amount, type, description } = req.body;

        const parsedAmount = parseFloat(amount);
        if (amount === undefined || isNaN(parsedAmount)) {
            return res.status(400).json({ message: 'Valid amount is required' });
        }
        if (!type || typeof type !== 'string' || type.trim() === '') {
            return res.status(400).json({ message: 'Type is required' });
        }
        if (!description || typeof description !== 'string' || description.trim() === '') {
            return res.status(400).json({ message: 'Description is required' });
        }

        // Perform balance check & updates atomically in a Prisma Transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch current tenant balance
            const tenant = await tx.tenant.findUnique({
                where: { id: tenantId },
                select: { tokenBalance: true }
            });

            if (!tenant) {
                throw new Error('Tenant not found');
            }

            // 2. Check for sufficient balance if it's a deduction (amount is negative)
            if (parsedAmount < 0 && tenant.tokenBalance + parsedAmount < 0) {
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
    } catch (error) {
        console.error("Error in createTokenTransaction:", error.message);
        if (error.message === 'Tenant not found') {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === 'Insufficient token balance') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getTokenBalance,
    getTokenHistory,
    createTokenTransaction
};
