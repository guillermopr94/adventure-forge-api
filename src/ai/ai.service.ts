import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
    constructor() { }

    // --- Public "Smart" Methods ---

    async generateText(prompt: string, history: any[], googleKey?: string, pollinationsKey?: string, model?: string): Promise<string> {
        const errors: string[] = [];

        // 1. Try Gemini
        if (googleKey) {
            try {
                return await this.generateGeminiText(prompt, history, googleKey, model);
            } catch (e: any) {
                console.warn("Gemini Text failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        // 2. Try Pollinations
        try {
            return await this.generatePollinationsText(prompt, history, pollinationsKey);
        } catch (e: any) {
            console.warn("Pollinations Text failed:", e.message);
            errors.push(`Pollinations: ${e.message}`);
        }

        throw new Error(`All Text providers failed: ${errors.join(", ")}`);
    }

    async generateAudio(text: string, voice: string, genre: string, lang: string, googleKey?: string, pollinationsKey?: string, openaiKey?: string): Promise<string> {
        const errors: string[] = [];

        // 1. Try Pollinations (Best quality/free tier options often preferred by user)
        try {
            return await this.generatePollinationsAudio(text, voice, genre, pollinationsKey);
        } catch (e: any) {
            console.warn("Pollinations Audio failed:", e.message);
            errors.push(`Pollinations: ${e.message}`);
        }

        // 2. Try OpenAI (if key provided - logic from frontend)
        if (openaiKey && openaiKey.length > 5) {
            // Not implementing OpenAI distinct from Pollinations for now as Pollinations covers it, 
            // unless user explicitly wants direct OpenAI. 
            // Frontend had OpenAITTS separate. Assuming Pollinations uses OpenAI model effectively.
        }

        // 3. Try Kokoro (Good backup)
        try {
            return await this.generateKokoroAudio(text, lang, genre);
        } catch (e: any) {
            console.warn("Kokoro Audio failed:", e.message);
            errors.push(`Kokoro: ${e.message}`);
        }

        // 4. Try Gemini
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
        // 1. Try Gemini (High quality)
        if (googleKey) {
            try {
                return await this.generateGeminiImage(prompt, googleKey);
            } catch (e: any) {
                console.warn("Gemini Image failed:", e.message);
            }
        }

        // 2. Try Pollinations (Reliable fallback)
        try {
            return await this.generatePollinationsImage(prompt);
        } catch (e: any) {
            throw new Error(`All Image providers failed. Last error: ${e.message}`);
        }
    }

    // --- Private Provider Implementations ---

    private async generateGeminiText(prompt: string, history: any[], apiKey: string, model?: string): Promise<string> {
        const { GoogleGenAI } = require("@google/genai");
        const client = new GoogleGenAI({ apiKey });

        let fullPrompt = "";
        history.forEach(msg => {
            const text = msg.parts ? msg.parts[0].text : "";
            fullPrompt += `${msg.role === 'user' ? 'User' : 'Model'}: ${text}\n`;
        });
        fullPrompt += `User: ${prompt}\nModel:`;

        const response = await client.models.generateContent({
            model: model || 'gemini-1.5-flash',
            contents: fullPrompt,
            config: { temperature: 0.7 }
        });
        return response.text;
    }

    private async generatePollinationsText(prompt: string, history: any[], token?: string): Promise<string> {
        let fullPrompt = "";
        history.forEach(msg => {
            const text = msg.parts ? msg.parts[0].text : "";
            fullPrompt += `${msg.role === 'user' ? 'User' : 'Model'}: ${text}\n`;
        });
        fullPrompt += `User: ${prompt}\nModel:`;

        const encodedPrompt = encodeURIComponent(fullPrompt);
        let url = "";

        if (token) {
            url = `https://gen.pollinations.ai/text/${encodedPrompt}?key=${token}`;
        } else {
            url = `https://text.pollinations.ai/${encodedPrompt}`;
        }

        const headers: any = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { headers });
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
