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

const CREDIT_PACKS = {
    small: { id: 'small', name: 'Small Pack', credits: 20, price: 3000, scans: 10 },
    medium: { id: 'medium', name: 'Medium Pack', credits: 50, price: 6500, scans: 25 },
    large: { id: 'large', name: 'Large Pack', credits: 120, price: 14000, scans: 60 }
};

/**
 * @desc    Purchase a predefined BakeWealth credit pack (Small, Medium, Large)
 * @route   POST /api/tokens/pack
 * @access  Private
 */
const purchaseCreditPack = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { packId, reference } = req.body;

    const pack = CREDIT_PACKS[(packId || '').toLowerCase()];
    if (!pack) {
        res.status(400);
        throw new Error('Invalid credit pack selected. Choose "small", "medium", or "large".');
    }

    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true }
        });

        if (!tenant) {
            res.status(404);
            throw new Error('Tenant not found');
        }

        const transaction = await tx.tokenTransaction.create({
            data: {
                tenantId,
                amount: pack.credits,
                type: 'purchase',
                description: `Credit Pack Purchase: ${pack.name} (+${pack.credits} credits · ~${pack.scans} scans) [Ref: ${reference || 'PACK-' + Date.now()}]`
            }
        });

        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: {
                tokenBalance: {
                    increment: pack.credits
                }
            },
            select: { tokenBalance: true }
        });

        return {
            pack,
            transaction,
            newBalance: updatedTenant.tokenBalance
        };
    });

    res.status(200).json(result);
});

/**
 * @desc    Automatically refund credits for a failed AI scan
 * @route   POST /api/tokens/refund
 * @access  Private
 */
const refundScanCredits = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { credits, reason } = req.body;

    const refundAmount = Math.max(0.1, parseFloat(credits) || 2);
    const refundReason = reason || 'Automatic refund: Failed scan extraction';

    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true }
        });

        if (!tenant) {
            res.status(404);
            throw new Error('Tenant not found');
        }

        const transaction = await tx.tokenTransaction.create({
            data: {
                tenantId,
                amount: refundAmount,
                type: 'refund',
                description: refundReason
            }
        });

        const updatedTenant = await tx.tenant.update({
            where: { id: tenantId },
            data: {
                tokenBalance: {
                    increment: refundAmount
                }
            },
            select: { tokenBalance: true }
        });

        return {
            refunded: refundAmount,
            transaction,
            newBalance: updatedTenant.tokenBalance
        };
    });

    res.status(200).json(result);
});

module.exports = {
    CREDIT_PACKS,
    getTokenBalance,
    getTokenHistory,
    createTokenTransaction,
    purchaseCreditPack,
    refundScanCredits
};

