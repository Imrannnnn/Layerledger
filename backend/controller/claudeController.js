const { asyncHandler } = require('../middleware/custommiddleware');

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
            return res.json(data);
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
