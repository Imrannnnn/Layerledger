/**
 * ----------------------------------------------------------------------
 * Financial Assistant Controller
 * ----------------------------------------------------------------------
 * Controller endpoints for the AI-powered Financial Assistant.
 * Enforces:
 * 1. Strict Tenant Isolation
 * 2. Role-Based Access Control (Owner / authorized financial role)
 * 3. Premium Subscription Gatekeeping (server-side enforcement)
 * ----------------------------------------------------------------------
 */

const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const { getEffectivePlan } = require('./planController');
const financialAnalyticsService = require('../services/financialAnalyticsService');
const financialAssistantService = require('../services/financialAssistantService');

/**
 * Helper to verify tenant exists and has an active Premium plan
 */
const verifyPremiumAccess = async (tenantId) => {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            id: true,
            name: true,
            settings: true,
            tokenBalance: true
        }
    });

    if (!tenant) {
        return { authorized: false, status: 404, error: 'Tenant not found.' };
    }

    const effective = getEffectivePlan(tenant);
    const hasPremium = effective.plan === 'premium' && !effective.isExpired;

    if (!hasPremium) {
        return {
            authorized: false,
            status: 403,
            code: 'PREMIUM_PLAN_REQUIRED',
            message: 'The AI Financial Intelligence Assistant is exclusively available for active Premium plan subscribers. Please upgrade your subscription to access conversational financial insights.',
            plan: effective.plan,
            isExpired: effective.isExpired,
            upgradePlan: 'premium',
            upgradePrice: 10000,
            effective
        };
    }

    return { authorized: true, tenant, effective };
};

/**
 * @desc    Get access status & entitlement for the AI Financial Assistant
 * @route   GET /api/financial-assistant/status
 * @access  Private
 */
const getAssistantStatus = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            id: true,
            name: true,
            settings: true,
            tokenBalance: true
        }
    });

    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found.');
    }

    const effective = getEffectivePlan(tenant);
    const hasPremium = effective.plan === 'premium' && !effective.isExpired;

    res.json({
        hasAccess: hasPremium,
        plan: effective.plan,
        rawPlan: effective.rawPlan,
        isExpired: effective.isExpired,
        daysRemaining: effective.daysRemaining,
        planExpiresAt: effective.planExpiresAt,
        tokenBalance: tenant.tokenBalance || 0,
        upgradePlan: 'premium',
        upgradePrice: 10000,
        message: hasPremium
            ? 'Active Premium plan: Full conversational financial intelligence enabled.'
            : 'Upgrade to Premium for conversational financial analysis, profit breakdowns, and live business intelligence.'
    });
});

/**
 * @desc    Get consolidated financial overview dataset
 * @route   GET /api/financial-assistant/overview
 * @access  Private (Premium Only)
 */
const getFinancialOverview = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    const check = await verifyPremiumAccess(tenantId);
    if (!check.authorized) {
        return res.status(check.status).json(check);
    }

    const targetMonth = req.query.month || null;
    const overview = await financialAnalyticsService.getConsolidatedFinancialReport(tenantId, targetMonth);

    res.json({
        success: true,
        data: overview
    });
});

/**
 * @desc    Send a question to the AI Financial Assistant
 * @route   POST /api/financial-assistant/chat
 * @access  Private (Premium Only)
 */
const chatWithAssistant = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { message, question, conversationHistory, month } = req.body;

    const userQuery = (message || question || '').trim();
    if (!userQuery) {
        res.status(400);
        throw new Error('A question or message is required for the financial assistant.');
    }

    // Server-side Premium restriction enforcement
    const check = await verifyPremiumAccess(tenantId);
    if (!check.authorized) {
        return res.status(check.status).json(check);
    }

    const result = await financialAssistantService.answerFinancialQuery({
        tenantId,
        question: userQuery,
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        targetMonth: month || null
    });

    res.json({
        success: true,
        ...result
    });
});

module.exports = {
    getAssistantStatus,
    getFinancialOverview,
    chatWithAssistant
};
