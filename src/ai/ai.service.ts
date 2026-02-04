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

        // Define prioritized strategies with fallback logic
        const strategies = [
            { name: "Gemini 2.5 Flash", model: "gemini-2.5-flash", type: "gemini" },
            { name: "Gemini 2.5 Flash Lite", model: "gemini-2.5-flash-lite", type: "gemini" },
            { name: "Gemini 1.5 Pro", model: "gemini-1.5-pro", type: "gemini" },
            { name: "Gemini 1.5 Flash", model: "gemini-1.5-flash", type: "gemini" },
            { name: "Pollinations (OpenAI)", model: "openai", type: "pollinations" },
            { name: "Pollinations (Mistral)", model: "mistral", type: "pollinations" },
            { name: "Pollinations (SearchGPT)", model: "searchgpt", type: "pollinations" },
        ];

        for (const strategy of strategies) {
            try {
                if (strategy.type === "gemini" && !gKey) {
                    throw new Error("No Google API Key provided");
                }

                console.log(`[AiService] Attempting: ${strategy.name}`);
                
                return await this.withRetry(async () => {
                    if (strategy.type === "gemini") {
                        return await this.generateGeminiText(prompt, history, gKey, strategy.model);
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
        // 1. Try Gemini
        if (googleKey) {
            try {
                return await this.withRetry(() => this.generateGeminiImage(prompt, googleKey),
                    { retries: 2, baseDelay: 1000, name: 'Gemini Image' });
            } catch (e: any) {
                console.warn("[AiService] Gemini Image failed:", e.message);
            }
        }

        // 2. Try Pollinations
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt),
                { retries: 2, baseDelay: 1000, name: 'Pollinations Image' });
        } catch (e: any) {
            throw new Error(`All Image providers failed. Last error: ${e.message}`);
        }
    }

    async generateGameTurn(prompt: string, history: any[], genre: string, googleKey?: string, pollinationsKey?: string): Promise<any> {
        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;

        const systemPrompt = `You are an immersive game engine for a ${genre} adventure. 
Generate a JSON object representing the next state of the game.
Schema:
{
  "paragraphs": string[], // 1-3 paragraphs describing the scene and result of the user's action.
  "options": string[],    // Exactly 3 short, compelling choices for the player.
  "inventory_changes": string[], // Optional. List of items gained or lost (e.g., "+ Rusty Sword", "- 5 Gold").
  "stats_update": object // Optional. Numeric changes to player stats (e.g., { "HP": -10, "XP": 50 }).
}
Avoid markdown formatting, return ONLY the JSON object.`;

        const fullPrompt = `${systemPrompt}\n\nUser Action: ${prompt}`;

        const strategies = [
            { name: "Gemini 2.0 Flash", model: "gemini-2.0-flash", type: "gemini" },
            { name: "Gemini 1.5 Flash", model: "gemini-1.5-flash", type: "gemini" },
            { name: "Pollinations (OpenAI)", model: "openai", type: "pollinations" },
        ];

        for (const strategy of strategies) {
            try {
                if (strategy.type === "gemini" && !gKey) continue;

                console.log(`[AiService] Attempting Game Turn: ${strategy.name}`);
                
                const result = await this.withRetry(async () => {
                    if (strategy.type === "gemini") {
                        return await this.generateGeminiText(fullPrompt, history, gKey, strategy.model, true);
                    } else {
                        return await this.generatePollinationsText(`${fullPrompt}\nIMPORTANT: Respond ONLY with valid JSON.`, history, pKey, strategy.model);
                    }
                }, { retries: 2, baseDelay: 1000, name: strategy.name });

                try {
                    return JSON.parse(result);
                } catch (parseError) {
                    console.warn(`[AiService] JSON Parse failed for ${strategy.name}. Attempting to extract JSON...`);
                    const jsonMatch = result.match(/\{[\s\S]*\}/);
                    if (jsonMatch) return JSON.parse(jsonMatch[0]);
                    throw parseError;
                }
            } catch (e: any) {
                console.warn(`[AiService] Game Turn strategy ${strategy.name} failed: ${e.message}`);
            }
        }

        throw new Error("Failed to generate structured game turn with all providers.");
    }

    // --- Private Provider Implementations ---

    private async generateGeminiText(prompt: string, history: any[], apiKey: string | undefined, model: string, isJson: boolean = false): Promise<string> {
        if (!apiKey) throw new Error("API Key is missing for Gemini");

        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });
        
        const generationConfig: any = {};
        if (isJson) {
            generationConfig.responseMimeType = "application/json";
        }

        const genModel = client.getGenerativeModel({ 
            model: model,
            generationConfig 
        });

        // Use native history format if available
        if (history && Array.isArray(history) && history.length > 0) {
            // Filter and format history for Gemini SDK
            const contents = history.map(msg => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: msg.parts.map((p: any) => ({ text: p.text }))
            }));

            // Check if the last message in history is the same as the current prompt
            // To avoid duplication
            const lastMsg = contents[contents.length - 1];
            if (lastMsg && lastMsg.role === 'user' && lastMsg.parts[0].text === prompt) {
                // If it's already there, just use the history up to the last message
                // and call generateContent on the chat session or use the whole history.
                const result = await genModel.generateContent({ contents });
                const response = await result.response;
                return response.text();
            } else {
                // Append current prompt to history
                contents.push({
                    role: 'user',
                    parts: [{ text: prompt }]
                });
                const result = await genModel.generateContent({ contents });
                const response = await result.response;
                return response.text();
            }
        }

        // Fallback to single-turn if no history
        const result = await genModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
            throw new Error("Empty response from Gemini");
        }
        return text;
    }

    private async generatePollinationsText(prompt: string, history: any[], token: string | undefined, model: string): Promise<string> {
        let fullPrompt = "";
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const text = msg.parts ? msg.parts[0].text : "";
                // Pollinations expects a more standard chat format in the prompt if we don't use an endpoint that supports arrays
                fullPrompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${text}\n`;
            });
        }
        
        // Avoid duplication if prompt is already the last message in history
        const lastInHistory = history && history.length > 0 ? history[history.length - 1].parts[0].text : null;
        if (lastInHistory !== prompt) {
            fullPrompt += `User: ${prompt}\nAssistant:`;
        } else {
            fullPrompt += `Assistant:`;
        }

        const encodedPrompt = encodeURIComponent(fullPrompt);
        let url = `https://text.pollinations.ai/${encodedPrompt}?model=${model}`;

        if (token) {
            url += `&key=${token}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Pollinations Text Status ${response.status}`);
        return await response.text();
    }

    private async generatePollinationsAudio(text: string, voice: string, genre: string, token?: string): Promise<string> {
        const instructions = this.getStyleInstructions(genre || '');
        const prompt = `${instructions} Say exactly this: ${text}`;
        const encodedText = encodeURIComponent(prompt);
        let url = "";

        if (token) {
            url = `https://gen.pollinations.ai/text/${encodedText}?model=openai-audio&voice=${voice || 'alloy'}&key=${token}`;
        } else {
            url = `https://text.pollinations.ai/${encodedText}?model=openai-audio&voice=${voice || 'alloy'}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Pollinations Audio Status ${response.status}`);
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
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }

    private async generateGeminiAudio(text: string, apiKey: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });
        const model = client.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use stable model for tts if preview is flaky

        const result = await model.generateContent({
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
        
        const response = await result.response;
        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error("No audio data in Gemini response");
        return data;
    }

    private async generateGeminiImage(prompt: string, apiKey: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });
        const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Image support varies by region/model
        
        const result = await model.generateContent(prompt);
        const response = await result.response;

        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image data in Gemini response");
    }

    private async generatePollinationsImage(prompt: string): Promise<string> {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}&width=800&height=450&model=flux`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Pollinations Image Status ${response.status}`);
        const buffer = await response.arrayBuffer();
        return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
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
