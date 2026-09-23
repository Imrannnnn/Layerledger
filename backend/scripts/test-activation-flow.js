require('dotenv').config();
const prisma = require('../prisma');
const { registerUser, loginUser, activateUser } = require('../controller/authController');

async function run() {
    const testEmail = `e2e_activation_${Date.now()}@example.com`;
    console.log('--- 1. Testing Registration for:', testEmail);

    let regRes = {};
    const resMock = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(d) { regRes = d; return this; }
    };

    await registerUser({
        body: {
            name: 'Activation E2E Baker',
            email: testEmail,
            password: 'SecurePassword123!',
            companyName: 'BakeWealth Delights',
            tenantType: 'individual'
        }
    }, resMock, (err) => { if (err) throw err; });

    console.log('Registration response status:', resMock.statusCode, 'body:', regRes);
    if (!regRes.success || regRes.isActivated !== false) {
        throw new Error('Registration should return isActivated: false');
    }

    console.log('--- 2. Checking Database state');
    const userInDb = await prisma.user.findFirst({
        where: { email: testEmail.toLowerCase() }
    });
    console.log('User in DB:', {
        id: userInDb.id,
        email: userInDb.email,
        isActivated: userInDb.isActivated,
        hasToken: !!userInDb.activationToken
    });

    if (userInDb.isActivated !== false || !userInDb.activationToken) {
        throw new Error('User in DB must be unactivated with an activation token');
    }

    console.log('--- 3. Testing Login Before Activation (Should be blocked)');
    let blockedError = null;
    try {
        await loginUser({
            body: { email: testEmail, password: 'SecurePassword123!' }
        }, resMock, (err) => { if (err) throw err; });
    } catch (e) {
        blockedError = e;
    }

    console.log('Login blocked as expected:', blockedError?.message, '| notActivated:', blockedError?.notActivated);
    if (!blockedError || !blockedError.notActivated) {
        throw new Error('Unactivated user login was not blocked!');
    }

    console.log('--- 4. Testing Account Activation via Token');
    let actRes = {};
    const actResMock = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(d) { actRes = d; return this; }
    };

    await activateUser({
        body: { token: userInDb.activationToken }
    }, actResMock, (err) => { if (err) throw err; });

    console.log('Activation response:', {
        success: actRes.success,
        isNewRegistration: actRes.isNewRegistration,
        hasJwtToken: !!actRes.token
    });

    if (!actRes.success || !actRes.token || !actRes.isNewRegistration) {
        throw new Error('Activation failed to return JWT and isNewRegistration flag');
    }

    console.log('--- 5. Testing Login After Activation (Should succeed)');
    let loginAfterRes = {};
    const loginAfterMock = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(d) { loginAfterRes = d; return this; }
    };

    await loginUser({
        body: { email: testEmail, password: 'SecurePassword123!' }
    }, loginAfterMock, (err) => { if (err) throw err; });

    console.log('Login after activation successful! User ID:', loginAfterRes.id, '| Role:', loginAfterRes.role);
    if (!loginAfterRes.token) {
        throw new Error('Login after activation failed');
    }

    // Cleanup
    await prisma.tenant.delete({ where: { id: userInDb.tenantId } });
    console.log('\n✅ All steps verified successfully: Registration -> Activation Email -> Blocked Pre-Login -> Activation -> Direct Onboarding Session Session Hand-off!');
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ E2E test failed:', err);
        process.exit(1);
    });
