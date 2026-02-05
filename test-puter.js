
async function testPuter() {
    const PUTER_API_ENDPOINT = "https://api.puter.com/drivers/call";
    
    // Test Chat
    const chatPayload = {
        interface: "puter-chat-completion",
        driver: "openai",
        method: "complete",
        args: {
            messages: [{ role: "user", content: "Say hello" }],
            model: "gpt-4o-mini",
            stream: false
        }
    };

    console.log("Testing Puter Chat (No Token)...");
    try {
        const response = await fetch(PUTER_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatPayload)
        });
        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error:", e.message);
    }

    // Test Image
    const imagePayload = {
        interface: "puter-image-generation",
        driver: "puter-image-generation",
        method: "generate",
        args: {
            prompt: "A beautiful sunset over the mountains",
            model: "gpt-image-1-mini"
        }
    };

    console.log("\nTesting Puter Image (No Token)...");
    try {
        const response = await fetch(PUTER_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(imagePayload)
        });
        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Response (truncated):", JSON.stringify(data, null, 2).substring(0, 200));
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testPuter();
