
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.POLLINATIONS_TOKEN;
console.log("Token:", token ? "FOUND" : "MISSING");

async function testText() {
    console.log("\n--- Testing Text Generation ---");
    const url = "https://gen.pollinations.ai/v1/chat/completions";
    const body = {
        messages: [{ role: "user", content: "Hello, tell me a 5 word story." }],
        model: "openai", // Try 'openai' or 'mistral'
        stream: false
    };

    // Test 1: Bearer Token
    try {
        console.log("Attempt 1: Bearer Header");
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(body)
        });
        console.log("Status:", res.status);
        if (!res.ok) console.log("Body:", await res.text());
        else console.log("Success:", await res.json());
    } catch (e) { console.error("Error:", e); }

    // Test 2: Query Param (if previous failed)
    /*
    try {
        console.log("Attempt 2: Query Param");
        const res = await fetch(`${url}?key=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        console.log("Status:", res.status);
        if (!res.ok) console.log("Body:", await res.text());
        else console.log("Success:", await res.json());
    } catch (e) { console.error("Error:", e); }
    */
}

async function testImage() {
    console.log("\n--- Testing Image Generation ---");
    const prompt = "A futuristic city";
    const encodedPrompt = encodeURIComponent(prompt);
    // Method 1: GET with Query Param (like browser)
    const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=flux&nologo=true&seed=123&width=800&height=450&enhance=false&key=${token}`;

    try {
        console.log("Attempt 1: GET with Query Param");
        console.log("URL:", url.replace(token || '', '***'));
        const res = await fetch(url);
        console.log("Status:", res.status);
        if (!res.ok) console.log("Body:", await res.text());
        else console.log("Success: Image Buffer received (size: " + (await res.arrayBuffer()).byteLength + ")");
    } catch (e) { console.error("Error:", e); }
}

(async () => {
    await testText();
    await testImage();
})();
