import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
    constructor() { }

    /**
     * Resilient execution wrapper with exponential retry.
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        options: { retries: number; baseDelay: number; name: string } = { retries: 3, baseDelay: 1000, name: 'AI Operation' }
    ): Promise<T> {
        let lastError: any;
        for (let i = 0; i < options.retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                const isRetryable = error.status === 429 || error.status >= 500 || error.message?.includes('fetch') || error.message?.includes('timeout');

                if (!isRetryable || i === options.retries - 1) {
                    throw error;
                }

                const delay = options.baseDelay * Math.pow(2, i);
                console.warn(`[AiService] ${options.name} failed (attempt ${i + 1}/${options.retries}). Retrying in ${delay}ms... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    // --- Public "Smart" Methods ---

    async generateText(prompt: string, history: any[], googleKey?: string, pollinationsKey?: string, unusedModel?: string): Promise<string> {
        const errors: string[] = [];
        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;
        const puterToken = process.env.PUTER_TOKEN;

        // Define prioritized strategies with fallback logic
        const strategies = [
            { name: "Gemini 2.5 Flash", model: "models/gemini-2.5-flash", type: "gemini" },
            { name: "Gemini Flash Latest", model: "models/gemini-flash-latest", type: "gemini" },
            { name: "Gemini 2.0 Flash", model: "models/gemini-2.0-flash", type: "gemini" },
            { name: "Gemini Pro Latest", model: "models/gemini-pro-latest", type: "gemini" },
            { name: "Puter AI (Claude)", model: "claude-sonnet-4", type: "puter" },
            { name: "Puter AI (GPT-4o)", model: "gpt-4o", type: "puter" },
            { name: "Pollinations (OpenAI)", model: "openai", type: "pollinations" },
            { name: "Pollinations (Mistral)", model: "mistral", type: "pollinations" },
        ];

        for (const strategy of strategies) {
            try {
                if (strategy.type === "gemini" && !gKey) continue;
                if (strategy.type === "puter" && !puterToken) continue;

                console.log(`[AiService] Attempting: ${strategy.name}`);

                return await this.withRetry(async () => {
                    if (strategy.type === "gemini") {
                        return await this.generateGeminiText(prompt, history, gKey, strategy.model);
                    } else if (strategy.type === "puter") {
                        return await this.generatePuterText(prompt, history, puterToken!, strategy.model);
                    } else {
                        return await this.generatePollinationsText(prompt, history, pKey, strategy.model);
                    }
                }, { retries: 2, baseDelay: 1000, name: strategy.name });

            } catch (e: any) {
                console.warn(`[AiService] ${strategy.name} failed after retries: ${e.message}`);
                errors.push(`${strategy.name}: ${e.message}`);
            }
        }

        throw new Error(`All Text providers failed. Errors: ${errors.join(" | ")}`);
    }

    private async generatePuterText(prompt: string, history: any[], token: string, model: string): Promise<string> {
        const url = "https://api.puter.com/drivers/call";
        
        // Build messages in OpenAI format
        const messages: any[] = [];
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const text = msg.parts && msg.parts[0] ? msg.parts[0].text : "";
                if (text) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: text
                    });
                }
            });
        }
        messages.push({ role: 'user', content: prompt });

        const payload = {
            interface: "puter-chat-completion",
            driver: this.getPuterDriver(model),
            method: "complete",
            args: {
                messages: messages,
                model: model,
                stream: false
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Puter Text Status ${response.status}`);
        const data = await response.json();
        
        // Puter structure: { result: { message: { content: "..." } } } or similar
        const result = data.result || data;
        const message = result.message || (result.choices && result.choices[0] && result.choices[0].message);
        
        if (message && message.content) {
            if (Array.isArray(message.content)) {
                return message.content.map((p: any) => p.text || "").join("");
            }
            return message.content;
        }
        
        throw new Error("Invalid response from Puter Text API");
    }

    private getPuterDriver(model: string): string {
        if (model.includes('claude')) return 'anthropic';
        if (model.includes('gpt')) return 'openai';
        if (model.includes('gemini')) return 'gemini';
        return 'openai'; // default
    }

    async generateAudio(text: string, voice: string, genre: string, lang: string, googleKey?: string, pollinationsKey?: string, openaiKey?: string): Promise<string> {
        const errors: string[] = [];

        // 1. Try Pollinations 
        try {
            return await this.withRetry(() => this.generatePollinationsAudio(text, voice, genre, pollinationsKey),
                { retries: 2, baseDelay: 500, name: 'Pollinations Audio' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations Audio failed:", e.message);
            errors.push(`Pollinations: ${e.message}`);
        }

        // 2. Try Kokoro
        try {
            return await this.withRetry(() => this.generateKokoroAudio(text, lang, genre),
                { retries: 2, baseDelay: 500, name: 'Kokoro Audio' });
        } catch (e: any) {
            console.warn("[AiService] Kokoro Audio failed:", e.message);
            errors.push(`Kokoro: ${e.message}`);
        }

        // 3. Try Gemini (if key)
        if (googleKey) {
            try {
                return await this.withRetry(() => this.generateGeminiAudio(text, googleKey),
                    { retries: 2, baseDelay: 500, name: 'Gemini Audio' });
            } catch (e: any) {
                console.warn("[AiService] Gemini Audio failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        throw new Error(`All Audio providers failed: ${errors.join(", ")}`);
    }

    async generateImage(prompt: string, googleKey?: string): Promise<string> {
        const errors: string[] = [];
        
        // 1. Try Gemini (Imagen 3 via Gemini Flash)
        if (googleKey || process.env.GOOGLE_API_KEY) {
            const gKey = googleKey || process.env.GOOGLE_API_KEY;
            try {
                return await this.withRetry(() => this.generateGeminiImage(prompt, gKey!),
                    { retries: 2, baseDelay: 1500, name: 'Gemini Image' });
            } catch (e: any) {
                console.warn("[AiService] Gemini Image failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        // 2. Try Puter AI (High Reliability Fallback - Requires PUTER_TOKEN)
        const puterToken = process.env.PUTER_TOKEN;
        if (puterToken) {
            try {
                return await this.withRetry(() => this.generatePuterImage(prompt, puterToken),
                    { retries: 2, baseDelay: 1000, name: 'Puter Image' });
            } catch (e: any) {
                console.warn("[AiService] Puter Image failed:", e.message);
                errors.push(`Puter: ${e.message}`);
            }
        }

        const pKey = process.env.POLLINATIONS_TOKEN;

        // 3. Try Pollinations (Flux) - Main Strategy
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'flux'),
                { retries: 2, baseDelay: 2000, name: 'Pollinations Flux' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations Flux failed:", e.message);
            errors.push(`Pollinations (Flux): ${e.message}`);
        }

        // 4. Try Pollinations (Turbo) - High Availability Fallback
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'turbo'),
                { retries: 2, baseDelay: 2000, name: 'Pollinations Turbo' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations Turbo failed:", e.message);
            errors.push(`Pollinations (Turbo): ${e.message}`);
        }

        // 5. Try Pollinations (Stable Diffusion XL) - Legacy Fallback
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'stable-diffusion-xl'),
                { retries: 1, baseDelay: 1000, name: 'Pollinations SDXL' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations SDXL failed:", e.message);
            errors.push(`Pollinations (SDXL): ${e.message}`);
        }

        // 6. Try Legacy Pollinations Endpoint (No Token Required)
        try {
            return await this.withRetry(() => this.generateLegacyPollinationsImage(prompt),
                { retries: 1, baseDelay: 1000, name: 'Legacy Pollinations' });
        } catch (e: any) {
            console.warn("[AiService] Legacy Pollinations failed:", e.message);
            errors.push(`Legacy Pollinations: ${e.message}`);
        }

        throw new Error(`All Image providers failed. Errors: ${errors.join(" | ")}`);
    }

    private async generatePuterImage(prompt: string, token: string): Promise<string> {
        const url = "https://api.puter.com/drivers/call";
        const payload = {
            interface: "puter-image-generation",
            driver: "puter-image-generation",
            method: "generate",
            args: {
                prompt: prompt,
                model: "gpt-image-1-mini",
                ratio: { w: 512, h: 512 }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Puter Image Status ${response.status}`);
        const data = await response.json();
        
        // Puter returns a data URL in response.result or data.result
        const result = data.result || data;
        if (typeof result === 'string' && result.startsWith('data:image')) {
            return result;
        }
        
        throw new Error("Invalid response from Puter Image API");
    }

    private async generateLegacyPollinationsImage(prompt: string): Promise<string> {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 1000000);
        // Standard legacy endpoint: https://image.pollinations.ai/prompt/{prompt}?seed={seed}&width=512&height=512&nologo=true
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=512&height=512&nologo=true`;
        
        console.log(`[AiService] Calling Legacy Pollinations: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Legacy Pollinations Status ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    }

    // ... (generateGameTurn omitted) ...



    // ...

    private async generatePollinationsImage(prompt: string, model: string = 'flux'): Promise<string> {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000);
        const token = process.env.POLLINATIONS_TOKEN;

        // Using new endpoint: https://gen.pollinations.ai/image/...
        // Mobile optimization requested: Portrait mode (Vertical)
        // Swapped width/height to 450x800 (9:16 approx)
        let url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&nologo=true&seed=${seed}&width=450&height=800&enhance=false`;

        if (token) {
            url += `&key=${token}`;
        }

        console.log(`[AiService] Calling Pollinations Image: ${url.replace(/key=[^&]+/, 'key=***')}`);

        const response = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[AiService] Pollinations Image Error (${response.status}): ${errText}`);
            throw new Error(`Pollinations Image Status ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    }

    async generateGameTurn(prompt: string, history: any[], genre: string, googleKey?: string, pollinationsKey?: string): Promise<any> {
        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;
        const puterToken = process.env.PUTER_TOKEN;

        const systemPrompt = `You are an immersive game engine for a ${genre} adventure. 
Generate a JSON object representing the next state of the game based on the user's action and the previous history.

JSON Schema to follow:
{
  "paragraphs": ["description of what happens"],
  "options": ["choice 1", "choice 2", "choice 3"],
  "inventory_changes": [],
  "stats_update": {}
}

IMPORTANT: YOUR ENTIRE RESPONSE MUST BE VALID JSON. NO CONVERSATION. NO MARKDOWN. START YOUR RESPONSE WITH '{' AND END WITH '}'.`;

        const strategies = [
            { name: "Gemini 2.5 Flash", model: "models/gemini-2.5-flash", type: "gemini" },
            { name: "Gemini Flash Latest", model: "models/gemini-flash-latest", type: "gemini" },
            { name: "Gemini 2.0 Flash", model: "models/gemini-2.0-flash", type: "gemini" },
            { name: "Gemini Pro Latest", model: "models/gemini-pro-latest", type: "gemini" },
            { name: "Puter AI (Claude)", model: "claude-sonnet-4", type: "puter" },
            { name: "Puter AI (GPT-4o)", model: "gpt-4o", type: "puter" },
            { name: "Pollinations (Gemini Fast)", model: "gemini-fast", type: "pollinations" },
            { name: "Pollinations (OpenAI Fast)", model: "openai-fast", type: "pollinations" },
            { name: "Pollinations (Claude Fast)", model: "claude-fast", type: "pollinations" },
            { name: "Pollinations (Nova Fast)", model: "nova-fast", type: "pollinations" },
            { name: "Pollinations (Mistral)", model: "mistral", type: "pollinations" },
            { name: "Pollinations (OpenAI)", model: "openai", type: "pollinations" },
        ];

        for (const strategy of strategies) {
            try {
                if (strategy.type === "gemini" && !gKey) continue;
                if (strategy.type === "puter" && !puterToken) continue;

                console.log(`[AiService] Attempting Game Turn: ${strategy.name}`);

                const result = await this.withRetry(async () => {
                    if (strategy.type === "gemini") {
                        // For Gemini, we pass systemPrompt separately if possible, or as first message
                        return await this.generateGeminiText(prompt, history, gKey, strategy.model, true, systemPrompt);
                    } else if (strategy.type === "puter") {
                        const fullPrompt = `${systemPrompt}\n\nUser Action: ${prompt}\nIMPORTANT: Respond ONLY with valid JSON.`;
                        return await this.generatePuterText(fullPrompt, history, puterToken!, strategy.model);
                    } else {
                        const fullPrompt = `${systemPrompt}\n\nUser Action: ${prompt}\nIMPORTANT: Respond ONLY with valid JSON.`;
                        return await this.generatePollinationsText(fullPrompt, history, pKey, strategy.model);
                    }
                }, { retries: 2, baseDelay: 1000, name: strategy.name });

                try {
                    // Pre-process result to find the first '{' and last '}'
                    const firstBrace = result.indexOf('{');
                    const lastBrace = result.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        const jsonPart = result.substring(firstBrace, lastBrace + 1);
                        return JSON.parse(jsonPart);
                    }
                    return JSON.parse(result);
                } catch (parseError) {
                    console.warn(`[AiService] JSON Parse failed for ${strategy.name}. Result: ${result.substring(0, 100)}...`);

                    // Fallback: If it's pure text, try to wrap it in a JSON structure so the game doesn't crash
                    if (!result.includes('{')) {
                        console.warn(`[AiService] Result contains no JSON. Wrapping text in paragraphs.`);
                        return {
                            paragraphs: [result],
                            options: ["Continue", "Look around", "Wait"]
                        };
                    }
                    throw parseError;
                }
            } catch (e: any) {
                console.warn(`[AiService] Game Turn strategy ${strategy.name} failed: ${e.message}`);
            }
        }

        throw new Error("Failed to generate structured game turn with all providers.");
    }

    // --- Private Provider Implementations ---

    private async generateGeminiText(prompt: string, history: any[], apiKey: string | undefined, model: string, isJson: boolean = false, systemInstruction?: string): Promise<string> {
        if (!apiKey) throw new Error("API Key is missing for Gemini");

        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        // Build config for the request
        const requestConfig: any = { model };

        if (isJson) {
            requestConfig.generationConfig = {
                responseMimeType: "application/json"
            };
        }

        if (systemInstruction) {
            requestConfig.systemInstruction = systemInstruction;
        }

        // Build contents array
        const contents: any[] = [];

        // Add history if available
        if (history && Array.isArray(history) && history.length > 0) {
            history.forEach(msg => {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: msg.parts.map((p: any) => ({ text: p.text }))
                });
            });
        }

        // Add current prompt
        contents.push({
            role: 'user',
            parts: [{ text: prompt }]
        });

        requestConfig.contents = contents;

        // Call the new API
        const result = await client.models.generateContent(requestConfig);
        let text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error("Empty response from Gemini");
        }

        // Strip markdown if it returned code blocks despite JSON mode
        if (isJson && text.includes("```")) {
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        }

        return text;
    }

    private async generatePollinationsText(prompt: string, history: any[], token?: string, model: string = 'openai'): Promise<string> {
        // Build messages in OpenAI format
        const messages: any[] = [];

        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const text = msg.parts && msg.parts[0] ? msg.parts[0].text : "";
                if (text) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: text
                    });
                }
            });
        }

        // Add implicit system prompt behavior by appending, or just add the user prompt
        messages.push({ role: 'user', content: prompt });

        const url = `https://gen.pollinations.ai/v1/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                messages: messages,
                model: model,
                stream: false
            })
        });

        if (!response.ok) throw new Error(`Pollinations Text Status ${response.status}`);
        const json = await response.json();
        return json.choices?.[0]?.message?.content || "";
    }

    private async generatePollinationsAudio(text: string, voice: string, genre: string, token?: string): Promise<string> {
        const instructions = this.getStyleInstructions(genre || '');
        const prompt = `${instructions} Say exactly this: ${text}`;
        const encodedText = encodeURIComponent(prompt);

        // Verified: POST /v1/audio/speech fails (404). GET /text/... works.
        // Also verified: Token must be passed as 'key' query param.
        // Also verified: 'Microsoft Helena' etc causing 400. Must use OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
        const safeVoice = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice) ? voice : 'alloy';

        let url = `https://gen.pollinations.ai/text/${encodedText}?model=openai-audio&voice=${safeVoice}`;

        if (token) {
            url += `&key=${token}`;
        }

        console.log(`[AiService] Calling Pollinations Audio: ${url.replace(/key=[^&]+/, 'key=***')}`);

        const response = await fetch(url);
        if (!response.ok) {
            const errText = await response.text();
            console.error(`[AiService] Pollinations Audio Error (${response.status}): ${errText}`);
            throw new Error(`Pollinations Audio Status ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }

    private async generateKokoroAudio(text: string, lang: string, genre: string): Promise<string> {
        const url = "https://willyfox94-kokoro-tts-api.hf.space/tts";
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                lang: (lang || 'en').substring(0, 2).toLowerCase(),
                genre: (genre || 'fantasy').toLowerCase()
            })
        });

        if (!response.ok) throw new Error(`Kokoro error: ${response.status}`);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }

    private async generateGeminiAudio(text: string, apiKey: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        const result = await client.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{ role: 'user', parts: [{ text: text }] }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        } as any);

        const data = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error("No audio data in Gemini response");
        return data;
    }

    private async generateGeminiImage(prompt: string, apiKey: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        const result = await client.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const part = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.data);
        if (part && part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }

        throw new Error("No image data in Gemini response");
    }



    private getStyleInstructions(genre: string): string {
        const lowerGenre = genre.toLowerCase();
        if (lowerGenre.includes('fantasy')) return "Voice: Grand Storyteller. Tone: Epic, magical, and immersive. Delivery: Paced, dramatic, and clear. Pronunciation: Clear and distinct.";
        if (lowerGenre.includes('scifi') || lowerGenre.includes('sci-fi')) return "Voice: AI Interface. Tone: Analytical, futuristic, and precise. Delivery: Clean, slightly processed, and rapid but clear.";
        if (lowerGenre.includes('horror')) return "Voice: Narrator of Dread. Tone: Ominous, whispering, and suspenseful. Delivery: Slow, deliberate, and terrifying.";
        if (lowerGenre.includes('superhero')) return "Voice: Action Narrator. Tone: Heroic, urgent, and energetic. Delivery: Dynamic, punchy, and impactful.";
        if (lowerGenre.includes('romance')) return "Voice: Intimate Narrator. Tone: Soft, emotional, and warm. Delivery: Gentle, smooth, and heartfelt.";
        return "Voice: Clear Narrator. Tone: Engaging and natural.";
    }
}
