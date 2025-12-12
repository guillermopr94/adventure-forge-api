import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
    constructor() { }

    // --- Public "Smart" Methods ---

    async generateText(prompt: string, history: any[], googleKey?: string, pollinationsKey?: string, unusedModel?: string): Promise<string> {
        const errors: string[] = [];
        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;

        // Define prioritized strategies
        const strategies = [
            { name: "Gemini 2.5 Flash", fn: () => this.generateGeminiText(prompt, history, gKey, "gemini-2.5-flash") },
            { name: "Gemini 2.5 Flash Lite", fn: () => this.generateGeminiText(prompt, history, gKey, "gemini-2.5-flash-lite") },
            { name: "Gemini 1.5 Pro", fn: () => this.generateGeminiText(prompt, history, gKey, "gemini-1.5-pro") },
            { name: "Gemini 1.5 Flash", fn: () => this.generateGeminiText(prompt, history, gKey, "gemini-1.5-flash") },
            { name: "Pollinations (OpenAI)", fn: () => this.generatePollinationsText(prompt, history, pKey, "openai") },
            { name: "Pollinations (Mistral)", fn: () => this.generatePollinationsText(prompt, history, pKey, "mistral") },
            { name: "Pollinations (SearchGPT)", fn: () => this.generatePollinationsText(prompt, history, pKey, "searchgpt") },
        ];

        for (const strategy of strategies) {
            try {
                // If it's a Gemini strategy and we have no key, skip it immediately to save time/errors
                if (strategy.name.startsWith("Gemini") && !gKey) {
                    throw new Error("No Google API Key provided");
                }

                console.log(`Attempting: ${strategy.name}`);
                return await strategy.fn();
            } catch (e: any) {
                console.warn(`${strategy.name} failed: ${e.message}`);
                errors.push(`${strategy.name}: ${e.message}`);
            }
        }

        throw new Error(`All Text providers failed. Errors: ${errors.join(" | ")}`);
    }

    async generateAudio(text: string, voice: string, genre: string, lang: string, googleKey?: string, pollinationsKey?: string, openaiKey?: string): Promise<string> {
        const errors: string[] = [];

        // 1. Try Pollinations 
        try {
            return await this.generatePollinationsAudio(text, voice, genre, pollinationsKey);
        } catch (e: any) {
            console.warn("Pollinations Audio failed:", e.message);
            errors.push(`Pollinations: ${e.message}`);
        }

        // 2. Try Kokoro
        try {
            return await this.generateKokoroAudio(text, lang, genre);
        } catch (e: any) {
            console.warn("Kokoro Audio failed:", e.message);
            errors.push(`Kokoro: ${e.message}`);
        }

        // 3. Try Gemini (if key)
        if (googleKey) {
            try {
                return await this.generateGeminiAudio(text, googleKey);
            } catch (e: any) {
                console.warn("Gemini Audio failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        throw new Error(`All Audio providers failed: ${errors.join(", ")}`);
    }

    async generateImage(prompt: string, googleKey?: string): Promise<string> {
        // 1. Try Gemini
        if (googleKey) {
            try {
                return await this.generateGeminiImage(prompt, googleKey);
            } catch (e: any) {
                console.warn("Gemini Image failed:", e.message);
            }
        }

        // 2. Try Pollinations
        try {
            return await this.generatePollinationsImage(prompt);
        } catch (e: any) {
            throw new Error(`All Image providers failed. Last error: ${e.message}`);
        }
    }

    // --- Private Provider Implementations ---

    private async generateGeminiText(prompt: string, history: any[], apiKey: string | undefined, model: string): Promise<string> {
        if (!apiKey) throw new Error("API Key is missing for Gemini");

        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        let fullPrompt = "";
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const text = msg.parts ? msg.parts[0].text : "";
                fullPrompt += `${msg.role === 'user' ? 'User' : 'Model'}: ${text}\n`;
            });
        }

        fullPrompt += `User: ${prompt}\nModel:`;

        const response = await client.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: { temperature: 0.7 }
        });

        if (!response.text) {
            // Sometimes response structure varies or is blocked
            throw new Error("Empty response from Gemini");
        }
        return response.text;
    }

    private async generatePollinationsText(prompt: string, history: any[], token: string | undefined, model: string): Promise<string> {
        let fullPrompt = "";
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                const text = msg.parts ? msg.parts[0].text : "";
                fullPrompt += `${msg.role === 'user' ? 'User' : 'Model'}: ${text}\n`;
            });
        }
        fullPrompt += `User: ${prompt}\nModel:`;

        const encodedPrompt = encodeURIComponent(fullPrompt);
        let url = `https://text.pollinations.ai/${encodedPrompt}?model=${model}`;
        // If token exists, use authenticated endpoint? (Pollinations docs vary, but usually param 'key' works)
        // If the user meant "pollinations.ai" explicitly, the authenticated one is via gen.pollinations.ai sometimes?
        // Let's stick to the method that was working or falling back. 
        // Based on docs: https://text.pollinations.ai/PROMPT?model=MODEL

        if (token) {
            url += `&key=${token}`;
            // Some endpoints might be different for VIP, but let's try standard param first
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);
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
        if (!response.ok) throw new Error(`Status ${response.status}`);
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

        const response = await client.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!data) throw new Error("No audio data");
        return data;
    }

    private async generateGeminiImage(prompt: string, apiKey: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [{ text: prompt }] }
        });

        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("No image data");
    }

    private async generatePollinationsImage(prompt: string): Promise<string> {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${seed}&width=800&height=450&model=flux`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status ${response.status}`);
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
