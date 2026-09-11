const mockPrisma = {
    tenant: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ tokenBalance: 4.3 })
    },
    tokenTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'tx-1' })
    },
    $transaction: jest.fn(callback => callback(mockPrisma))
};

jest.mock('../prisma', () => mockPrisma);
const prisma = require('../prisma');
const { handleClaudeProxy } = require('../controller/claudeController');

describe('Claude Controller Unit Tests', () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {
                messages: [{ role: 'user', content: 'Say hello' }]
            },
            user: {
                tenantId: 'test-tenant-123'
            }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
            setHeader: jest.fn()
        };
    });

    test('should return 400 if messages is missing or not an array', async () => {
        req.body.messages = null;
        const next = jest.fn();
        await handleClaudeProxy(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toMatch(/Messages array is required/);
    });

    test('should return 402 with INSUFFICIENT_CREDITS if tenant balance is less than required credits (default 2)', async () => {
        prisma.tenant.findUnique.mockResolvedValue({ tokenBalance: 1.5 });
        const next = jest.fn();

        await handleClaudeProxy(req, res, next);

        expect(res.status).toHaveBeenCalledWith(402);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'INSUFFICIENT_CREDITS',
            requiredCredits: 2,
            currentBalance: 1.5
        }));
    });

    test('should return 402 with requiredCredits: 5 when feature is bank_statement', async () => {
        req.body.feature = 'bank_statement';
        prisma.tenant.findUnique.mockResolvedValue({ tokenBalance: 3.0 });
        const next = jest.fn();

        await handleClaudeProxy(req, res, next);

        expect(res.status).toHaveBeenCalledWith(402);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'INSUFFICIENT_CREDITS',
            requiredCredits: 5,
            currentBalance: 3.0
        }));
    });

    test('should return 402 if tenant balance is 0', async () => {
        prisma.tenant.findUnique.mockResolvedValue({ tokenBalance: 0 });
        const next = jest.fn();

        await handleClaudeProxy(req, res, next);

        expect(res.status).toHaveBeenCalledWith(402);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'INSUFFICIENT_CREDITS',
            requiredCredits: 2,
            currentBalance: 0
        }));
    });

    test('should proceed past credit check when tenant balance is >= cost', async () => {
        prisma.tenant.findUnique.mockResolvedValue({ tokenBalance: 5.0 });
        const next = jest.fn();

        // Will attempt Claude API request (or fail if API key not present, but past 402)
        await handleClaudeProxy(req, res, next);

        expect(res.status).not.toHaveBeenCalledWith(402);
    });
});

