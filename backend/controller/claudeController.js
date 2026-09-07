const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

const TOKEN_COST_PER_AI_REQUEST = 0.7;

/**
 * @desc    Proxy request to Anthropic Claude API using server-side key
 * @route   POST /api/claude
 * @access  Private
 */
const handleClaudeProxy = asyncHandler(async (req, res) => {
    const { messages, system, model, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
        res.status(400);
        throw new Error("Messages array is required.");
    }

    const tenantId = req.user?.tenantId;

    // 1. Enforce Token Balance Check if tenant is present
    if (tenantId) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { tokenBalance: true }
        });

        if (!tenant) {
            res.status(404);
            throw new Error("Tenant not found.");
        }

        const balance = tenant.tokenBalance || 0;
        if (balance < TOKEN_COST_PER_AI_REQUEST) {
            return res.status(402).json({
                error: "Insufficient tokens",
                code: "INSUFFICIENT_TOKENS",
                message: `You need at least ${TOKEN_COST_PER_AI_REQUEST} tokens to use this AI feature. You currently have ${balance.toFixed(1)} token${balance === 1 ? '' : 's'}. Please buy tokens to continue.`,
                currentBalance: balance,
                requiredTokens: TOKEN_COST_PER_AI_REQUEST
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

            // 2. Successful AI response — atomically deduct 0.7 tokens & record transaction
            let newBalance = null;
            if (tenantId) {
                try {
                    const txResult = await prisma.$transaction(async (tx) => {
                        const updatedTenant = await tx.tenant.update({
                            where: { id: tenantId },
                            data: {
                                tokenBalance: {
                                    decrement: TOKEN_COST_PER_AI_REQUEST
                                }
                            },
                            select: { tokenBalance: true }
                        });

                        await tx.tokenTransaction.create({
                            data: {
                                tenantId,
                                amount: -TOKEN_COST_PER_AI_REQUEST,
                                type: "ai_usage",
                                description: `AI feature usage (${TOKEN_COST_PER_AI_REQUEST} tokens deducted)`
                            }
                        });

                        return updatedTenant;
                    });
                    newBalance = Math.round(txResult.tokenBalance * 100) / 100;
                } catch (txErr) {
                    console.error("Token deduction error after successful AI call:", txErr);
                }
            }

            if (newBalance !== null) {
                res.setHeader('X-Token-Balance', String(newBalance));
            }

            return res.json({
                ...data,
                tokenUsage: {
                    tokensDeducted: TOKEN_COST_PER_AI_REQUEST,
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
