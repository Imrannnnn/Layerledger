require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const key = process.env.CLAUDE_API || process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

async function testModel() {
    console.log("Using key:", key ? `${key.substring(0, 15)}... (Length: ${key.length})` : "undefined");
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": key,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-5",
                max_tokens: 10,
                messages: [{ role: "user", content: "Hi, respond with exactly 'OK'" }]
            })
        });
        const status = response.status;
        const text = await response.text();
        console.log(`Status: ${status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error("Error:", e);
    }
}

testModel();
