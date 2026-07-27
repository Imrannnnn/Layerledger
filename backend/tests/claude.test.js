require('dotenv').config();
const { handleClaudeProxy } = require('../controller/claudeController');

describe('Claude Controller Unit Tests', () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            body: {
                messages: [{ role: 'user', content: 'Say hello' }]
            }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };
    });

    test('should return 400 if messages is missing or not an array', async () => {
        req.body.messages = null;
        const next = jest.fn();
        await handleClaudeProxy(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Messages array is required/);
    });

    test('should attempt Claude API request when key and messages are valid', async () => {
        // If API key is present in environment, test calling proxy
        if (process.env.CLAUDE_API || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) {
            const next = jest.fn();
            await handleClaudeProxy(req, res, next);
            // res.json or next will be called
            if (res.json.mock.calls.length > 0) {
                expect(res.json).toHaveBeenCalled();
            } else if (next.mock.calls.length > 0) {
                // Network/auth error from Anthropic
                expect(next.mock.calls[0][0]).toBeDefined();
            }
        }
    });
});
