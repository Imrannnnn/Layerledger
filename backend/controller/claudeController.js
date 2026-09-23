const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const subscriptionWatcher = require('../services/subscriptionWatcher');

const DEFAULT_RECEIPT_SCANNER_CREDIT_COST = 2;
const DEFAULT_BANK_STATEMENT_CREDIT_COST = 5;

/**
 * @desc    Proxy request to Anthropic Claude API using server-side key
 * @route   POST /api/claude
 * @access  Private
 */
const handleClaudeProxy = asyncHandler(async (req, res) => {
    const { messages, system, model, max_tokens, creditCost, feature } = req.body;

    if (!messages || !Array.isArray(messages)) {
        res.status(400);
        throw new Error("Messages array is required.");
    }

    const requestedCost = Number(creditCost);
    const cost = !isNaN(requestedCost) && requestedCost > 0
        ? requestedCost
        : (feature === 'bank_statement' ? DEFAULT_BANK_STATEMENT_CREDIT_COST : DEFAULT_RECEIPT_SCANNER_CREDIT_COST);

    const tenantId = req.user?.tenantId;
    const todayStr = new Date().toISOString().slice(0, 10);
    const DAILY_AI_CEILING = 100;

    // 1. Enforce Credit Balance & Daily Ceiling Check if tenant is present
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true, settings: true }
        });

        if (!tenant) {
            res.status(404);
            throw new Error("Tenant not found.");
        }

        const dailyUsage = tenant.settings?.dailyAiUsage || {};
        const countToday = dailyUsage.date === todayStr ? (dailyUsage.count || 0) : 0;

        if (countToday >= DAILY_AI_CEILING) {
            return res.status(429).json({
                error: "Daily AI ceiling reached",
                code: "DAILY_AI_CEILING_REACHED",
                message: `Your account has reached the daily limit of ${DAILY_AI_CEILING} AI scans to protect your balance from unintended loops. The limit resets at midnight.`,
                limit: DAILY_AI_CEILING,
                used: countToday
            });
        }

        const balance = tenant.tokenBalance || 0;
        if (balance < cost) {
            return res.status(402).json({
                error: "Insufficient credits",
                code: "INSUFFICIENT_CREDITS",
                message: `You need at least ${cost} credit${cost === 1 ? '' : 's'} to use this AI feature. You currently have ${balance.toFixed(1)} credit${balance === 1 ? '' : 's'}. Please top up credits to continue.`,
                currentBalance: balance,
                requiredCredits: cost,
                requiredTokens: cost
            });
        }
    }

    const key = process.env.CLAUDE_API || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!key) {
        res.status(500);
        throw new Error("Claude API key (CLAUDE_API, CLAUDE_API_KEY, or ANTHROPIC_API_KEY) is not configured on the server.");
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                    model: model || process.env.CLAUDE_MODEL || "claude-sonnet-5",
                    max_tokens: max_tokens || 4000,
                    system,
                    messages
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseText = await response.text();

            if (!response.ok) {
                if (response.status >= 500 || response.status === 429) {
                    throw new Error(`Anthropic API error (${response.status}): ${responseText}`);
                } else {
                    // Client error (e.g. invalid format)
                    res.status(response.status);
                    try {
                        const errorJson = JSON.parse(responseText);
                        return res.json(errorJson);
                    } catch {
                        return res.send(responseText);
                    }
                }
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (jsonErr) {
                res.status(502);
                throw new Error(`Invalid JSON response from Anthropic API: ${responseText.substring(0, 200)}`);
            }

            // 2. Successful AI response — atomically deduct credits & record transaction
            let newBalance = null;
            if (tenantId) {
                try {
                    const txResult = await prisma.$transaction(async (tx) => {
                        const currentT = await tx.tenant.findUnique({
                            where: { id: tenantId },
                            select: { settings: true, tokenBalance: true }
                        });
                        const curSettings = currentT?.settings || {};
                        const curDaily = curSettings.dailyAiUsage || {};
                        const curCount = curDaily.date === todayStr ? (curDaily.count || 0) : 0;

                        const updatedTenant = await tx.tenant.update({
                            where: { id: tenantId },
                            data: {
                                tokenBalance: {
                                    decrement: cost
                                },
                                settings: {
                                    ...curSettings,
                                    dailyAiUsage: {
                                        date: todayStr,
                                        count: curCount + 1
                                    }
                                }
                            },
                            select: { tokenBalance: true }
                        });

                        await tx.tokenTransaction.create({
                            data: {
                                tenantId,
                                amount: -cost,
                                type: "ai_usage",
                                description: `AI feature usage (${cost} credit${cost === 1 ? '' : 's'} deducted)`
                            }
                        });

                        return updatedTenant;
                    });
                    newBalance = Math.round(txResult.tokenBalance * 100) / 100;
                } catch (txErr) {
                    console.error("Credit deduction error after successful AI call:", txErr);
                }
            }

            if (newBalance !== null) {
                res.setHeader('X-Token-Balance', String(newBalance));

                // If balance drops to 4 credits (2 scans) or below, alert tenant owner
                if (newBalance <= 4) {
                    subscriptionWatcher.checkAndNotifyLowTokens(tenantId, newBalance).catch(err => {
                        console.error('[ClaudeController] Failed to send low token notification:', err.message);
                    });
                }
            }

            return res.json({
                ...data,
                tokenUsage: {
                    creditsDeducted: cost,
                    tokensDeducted: cost,
                    newBalance: newBalance
                }
            });
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, attempt * 1500));
            }
        }
    }

    res.status(500);
    throw new Error(`Failed to contact Anthropic API after ${maxRetries} attempts. Last error: ${lastError.message}`);
});

module.exports = {
    handleClaudeProxy
};
