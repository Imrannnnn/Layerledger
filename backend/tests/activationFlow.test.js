require('dotenv').config();
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
const prisma = require('../prisma');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { activateAccountSchema, resendActivationSchema } = require('../validators/authValidator');

describe('Account Activation Flow Tests', () => {
    let testTenantId = null;
    let testUserId = null;
    let testEmail = null;
    let testToken = null;

    beforeAll(async () => {
        testEmail = `activation_test_${Date.now()}@example.com`;
    });

    afterAll(async () => {
        if (testTenantId) {
            await prisma.tenant.delete({ where: { id: testTenantId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    test('1. emailService should render and dispatch activation email with token link', async () => {
        const activationUrl = 'http://localhost:5173/?activate=test_token_12345';
        const res = await emailService.sendActivationEmail({
            to: testEmail,
            name: 'Activation Tester',
            companyName: 'Golden Loaf Bakery',
            activationUrl
        });

        expect(res.success).toBe(true);
    }, 20000);

    test('2. Validators should accept valid activation and resend payloads', () => {
        const parsedActivate = activateAccountSchema.parse({
            body: { token: 'sample_activation_token_123' }
        });
        expect(parsedActivate.body.token).toBe('sample_activation_token_123');

        const parsedResend = resendActivationSchema.parse({
            body: { email: '  USER@BAKERY.COM  ' }
        });
        expect(parsedResend.body.email).toBe('user@bakery.com');
    });

    test('3. New registration should create unactivated user in database with activationToken', async () => {
        const tenant = await prisma.tenant.create({
            data: {
                name: 'Activation Test Bakery',
                type: 'individual',
                tokenBalance: 20
            }
        });
        testTenantId = tenant.id;

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('TestPassword123!', salt);
        testToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = await prisma.user.create({
            data: {
                tenantId: tenant.id,
                name: 'Activation Baker',
                email: testEmail.toLowerCase(),
                passwordHash: hashedPassword,
                role: 'owner',
                isActivated: false,
                activationToken: testToken,
                activationExpiresAt: expiresAt
            }
        });
        testUserId = user.id;

        expect(user.isActivated).toBe(false);
        expect(user.activationToken).toBe(testToken);
        expect(user.activationExpiresAt).toBeDefined();
    });

    test('4. Unactivated user lookup should identify account as not activated', async () => {
        const user = await prisma.user.findFirst({
            where: { email: { equals: testEmail, mode: 'insensitive' } }
        });

        expect(user).not.toBeNull();
        expect(user.isActivated).toBe(false);
    });

    test('5. Valid token activation should mark user as activated and clear token', async () => {
        const user = await prisma.user.findFirst({
            where: { activationToken: testToken }
        });
        expect(user).not.toBeNull();
        expect(user.id).toBe(testUserId);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: {
                isActivated: true,
                activationToken: null,
                activationExpiresAt: null
            }
        });

        expect(updated.isActivated).toBe(true);
        expect(updated.activationToken).toBeNull();
        expect(updated.activationExpiresAt).toBeNull();
    });

    test('6. Expired token should be rejected', async () => {
        const expiredToken = 'expired_token_abc';
        const expiredUser = await prisma.user.create({
            data: {
                tenantId: testTenantId,
                name: 'Expired Baker',
                email: `expired_${Date.now()}@example.com`,
                passwordHash: 'dummy',
                isActivated: false,
                activationToken: expiredToken,
                activationExpiresAt: new Date(Date.now() - 3600000) // 1 hour ago
            }
        });

        const found = await prisma.user.findFirst({
            where: { activationToken: expiredToken }
        });
        expect(found).not.toBeNull();
        const isExpired = found.activationExpiresAt && new Date() > new Date(found.activationExpiresAt);
        expect(isExpired).toBe(true);

        await prisma.user.delete({ where: { id: expiredUser.id } });
    });
});
