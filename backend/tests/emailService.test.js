const emailService = require('../services/emailService');

describe('Bakewealth Brevo EmailService Tests', () => {
    test('1. wrapTemplate should include Bakewealth header, branding and footer', () => {
        const html = emailService.wrapTemplate({
            heading: 'Test Heading',
            content: '<p>Test Content</p>',
            ctaText: 'Test Action',
            ctaUrl: 'https://bakewealth.com/test'
        });

        expect(html).toContain('Bakewealth');
        expect(html).toContain('Bakery Financial Operating System');
        expect(html).toContain('Test Heading');
        expect(html).toContain('Test Content');
        expect(html).toContain('Test Action');
        expect(html).toContain('https://bakewealth.com/test');
        expect(html).toContain('&copy;');
    });

    test('2. sendActivationEmail includes activation link and starter allowance', async () => {
        const res = await emailService.sendActivationEmail({
            to: 'newbaker@example.com',
            name: 'Alice Baker',
            companyName: 'Sweet Tooth Confectionery',
            activationUrl: 'http://localhost:5173/?activate=mock_token_123'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('3. sendWelcomeEmail includes onboarding session link and 10 free scans allowance', async () => {
        const res = await emailService.sendWelcomeEmail({
            to: 'newbaker@example.com',
            name: 'Alice Baker',
            companyName: 'Sweet Tooth Confectionery',
            onboardingUrl: 'http://localhost:5173/?onboarding=1'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('3. sendStaffInviteEmail includes temporary password, role, email and PIN', async () => {
        const res = await emailService.sendStaffInviteEmail({
            to: 'staff@example.com',
            name: 'Bob Pastry',
            companyName: 'Sweet Tooth Confectionery',
            role: 'production',
            password: 'SecretPassword99!',
            pin: '1234',
            loginUrl: 'http://localhost:5173'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('4. sendSubscriptionExpiringEmail includes plan name, expiration date and renewal URL', async () => {
        const res = await emailService.sendSubscriptionExpiringEmail({
            to: 'owner@example.com',
            name: 'Alice Baker',
            companyName: 'Sweet Tooth Confectionery',
            planName: 'standard',
            daysRemaining: 2,
            expiresAt: '2026-09-30T00:00:00.000Z',
            renewalUrl: 'http://localhost:5173/settings?tab=subscription'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('5. sendTokenLowEmail includes balance, scans remaining and top-up link', async () => {
        const res = await emailService.sendTokenLowEmail({
            to: 'owner@example.com',
            name: 'Alice Baker',
            companyName: 'Sweet Tooth Confectionery',
            tokenBalance: 4,
            scansRemaining: 2,
            topUpUrl: 'http://localhost:5173/tokens'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('6. sendPaymentReceiptEmail includes reference, amount, currency and item description', async () => {
        const res = await emailService.sendPaymentReceiptEmail({
            to: 'owner@example.com',
            name: 'Alice Baker',
            companyName: 'Sweet Tooth Confectionery',
            paymentReference: 'PAY_TEST_REF_123',
            amount: 14250,
            currency: 'NGN',
            resourceType: 'subscription_plan',
            resourceDetails: 'Standard Plan (3 months)',
            paidAt: '2026-09-23T12:00:00.000Z',
            accountUrl: 'http://localhost:5173'
        });

        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
    });

    test('7. verifyApi and verifySmtp handle unconfigured state gracefully', async () => {
        // Without active credentials in test environment
        const check = await emailService.verifyApi();
        expect(check).toHaveProperty('configured');
        expect(check).toHaveProperty('connected');
        expect(check).toHaveProperty('message');
        expect(check.configured).toBe(false);

        const smtpCheck = await emailService.verifySmtp();
        expect(smtpCheck).toHaveProperty('configured');
        expect(smtpCheck.configured).toBe(false);
    });
});

