const { GoogleGenAI } = require("@google/genai");

async function listModels() {
    const apiKey = "AIzaSyAZnRVnaxPU_ZiG6b6_qiZ4js1f09pp5mM";
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        console.log("Available models:");
        data.models?.forEach(model => {
            if (model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent')) {
                console.log(`- ${model.name} (supports: ${model.supportedGenerationMethods?.join(', ')})`);
            }
        });
    } catch (error) {
        console.error("Error:", error.message);
    }
}

listModels();
