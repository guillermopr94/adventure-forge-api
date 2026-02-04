const { GoogleGenAI } = require("@google/genai");
const apiKey = "AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM";
const client = new GoogleGenAI({ apiKey });

async function test() {
    try {
        console.log("Attempting to list models...");
        // In the new SDK, listModels might be under client.models.list()
        const models = await client.models.list();
        console.log("Available models:", JSON.stringify(models, null, 2));
        
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: "Hello, how are you?" }] }]
        });
        console.log("Response:", JSON.stringify(response, null, 2));
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
