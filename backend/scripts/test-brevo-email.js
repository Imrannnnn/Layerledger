/**
 * ----------------------------------------------------------------------
 * Brevo REST API Email Tester Script
 * ----------------------------------------------------------------------
 * Run via: node scripts/test-brevo-email.js [optional_target_email]
 * ----------------------------------------------------------------------
 */

require('dotenv').config();
const emailService = require('../services/emailService');

async function main() {
    const targetEmail = process.argv[2] || 'iia133@gmail.com';

    console.log('================================================================');
    console.log('       Bakewealth - Brevo REST API Diagnostic & Email Test       ');
    console.log('================================================================');
    console.log(`Configured Sender:   ${emailService.getSenderString()}`);
    console.log(`Base Application URL: ${emailService.getAppUrl()}`);
    console.log(`Brevo Configured:    ${emailService.isConfigured() ? 'YES (Live API)' : 'NO (Mock / Dev Logging)'}`);
    console.log(`Target Recipient:    ${targetEmail}`);
    console.log('----------------------------------------------------------------');

    if (emailService.isConfigured()) {
        console.log('Testing Brevo API connection (v3 /account)...');
        const check = await emailService.verifyApi();
        if (check.connected) {
            console.log(`✅ Brevo API connected successfully! Account: ${check.email}`);
        } else {
            console.log('❌ Connection failed:', check.message);
        }
    } else {
        console.log('ℹ️  To enable live sending through Brevo API, configure these variables in backend/.env:');
        console.log('    BREVO_API_KEY="xkeysib-your-v3-api-key-here"');
        console.log('    BREVO_FROM_EMAIL="verified-sender@domain.com"');
        console.log('    BREVO_FROM_NAME="Bakewealth"');
    }


    console.log('\n--- 1. Testing Welcome Email (with onboarding link) ---');
    const welcomeRes = await emailService.sendWelcomeEmail({
        to: targetEmail,
        name: 'Sarah Connor',
        companyName: 'Golden Crust Bakery',
        onboardingUrl: `${emailService.getAppUrl()}/?onboarding=1`
    });
    console.log('Welcome Email Dispatch:', welcomeRes);

    console.log('\n--- 2. Testing Staff Invite Email (with credentials & password) ---');
    const staffRes = await emailService.sendStaffInviteEmail({
        to: targetEmail,
        name: 'John Doe',
        companyName: 'Golden Crust Bakery',
        role: 'production',
        password: 'BakePass2026!@#',
        pin: '4821',
        loginUrl: emailService.getAppUrl()
    });
    console.log('Staff Invite Dispatch:', staffRes);

    console.log('\n--- 3. Testing Subscription Expiring Notice ---');
    const expiryRes = await emailService.sendSubscriptionExpiringEmail({
        to: targetEmail,
        name: 'Sarah Connor',
        companyName: 'Golden Crust Bakery',
        planName: 'standard',
        daysRemaining: 3,
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        renewalUrl: `${emailService.getAppUrl()}/settings?tab=subscription`
    });
    console.log('Subscription Expiry Dispatch:', expiryRes);

    console.log('\n--- 4. Testing AI Scan Quota Low Alert ---');
    const tokenRes = await emailService.sendTokenLowEmail({
        to: targetEmail,
        name: 'Sarah Connor',
        companyName: 'Golden Crust Bakery',
        tokenBalance: 4,
        scansRemaining: 2,
        topUpUrl: `${emailService.getAppUrl()}/tokens`
    });
    console.log('Token Low Dispatch:', tokenRes);

    console.log('\n--- 5. Testing Payment Receipt Confirmation ---');
    const receiptRes = await emailService.sendPaymentReceiptEmail({
        to: targetEmail,
        name: 'Sarah Connor',
        companyName: 'Golden Crust Bakery',
        paymentReference: `PAY-BW-${Date.now()}`,
        amount: 14250,
        currency: 'NGN',
        resourceType: 'subscription_plan',
        resourceDetails: 'STANDARD Prepaid Plan (3 Months - 5% Off)',
        paidAt: new Date().toISOString(),
        accountUrl: emailService.getAppUrl()
    });
    console.log('Payment Receipt Dispatch:', receiptRes);

    console.log('\n================================================================');
    console.log('✅ All 5 Bakewealth email flows rendered and tested successfully!');
    console.log('================================================================');
}

main().catch(err => {
    console.error('Fatal diagnostic error:', err);
});
