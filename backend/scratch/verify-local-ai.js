// Use global native fetch

async function run() {
    console.log("=========================================");
    console.log("Starting Local AI Proxy End-to-End Test");
    console.log("=========================================");

    const host = 'http://localhost:4000';
    const email = `test_ai_${Date.now()}@example.com`;
    const password = 'Password123!';

    try {
        // 1. Register a new user & tenant
        console.log(`1. Registering user: ${email}...`);
        const registerRes = await fetch(`${host}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test AI User',
                email: email,
                password: password,
                tenantType: 'individual'
            })
        });

        const registerData = await registerRes.json();
        if (!registerRes.ok) {
            throw new Error(`Registration failed: ${JSON.stringify(registerData)}`);
        }
        console.log("✅ User registered successfully.");

        // 2. Login to get JWT Token
        console.log("2. Logging in...");
        const loginRes = await fetch(`${host}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password
            })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        }
        const token = loginData.token;
        console.log("✅ Logged in successfully. Token acquired.");

        // 3. Test Claude AI Proxy Endpoint
        console.log("3. Testing Claude AI Proxy endpoint...");
        const modelsToTry = [
            "claude-sonnet-5",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-sonnet-20240620",
            "claude-3-haiku-20240307"
        ];

        let success = false;

        for (const model of modelsToTry) {
            console.log(`Trying model: ${model}...`);
            const claudeRes = await fetch(`${host}/api/claude`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    model,
                    messages: [{ role: 'user', content: 'Respond with exactly the word OK' }],
                    system: 'Respond with exactly the word OK'
                })
            });

            const claudeData = await claudeRes.json();
            if (claudeRes.ok) {
                console.log(`🎉 SUCCESS with model ${model}! Response:`, JSON.stringify(claudeData));
                success = true;
                break;
            } else {
                console.log(`❌ Failed for ${model}:`, JSON.stringify(claudeData));
            }
        }

        if (!success) {
            throw new Error("All tried models failed.");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    }
    console.log("=========================================");
}

run();
