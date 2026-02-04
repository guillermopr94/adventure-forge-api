const { GoogleGenAI } = require("@google/genai");
const apiKey = "AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM";
const client = new GoogleGenAI({ apiKey });

async function test() {
    try {
        console.log("Testing generateContent...");
        const response = await client.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{ role: "user", parts: [{ text: "Say 'Hello World'" }] }]
        });
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
