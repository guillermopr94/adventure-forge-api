const { GoogleGenAI } = require("@google/genai");
const apiKey = "AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM";
const client = new GoogleGenAI({ apiKey });

async function test() {
    try {
        console.log("Testing generateContent with JSON mode...");
        const response = await client.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{ role: "user", parts: [{ text: "Generate a JSON object with a 'message' field saying 'Hello World'" }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
        console.log("Response:", JSON.stringify(response, null, 2));
        console.log("Text content:", response.candidates[0].content.parts[0].text);
    } catch (e) {
        console.error("Test failed:", e);
    }
}

test();
