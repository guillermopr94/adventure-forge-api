import { Injectable } from '@nestjs/common';

@Injectable()
export class AiService {
    private quotaLogs: { timestamp: number; provider: string; model: string; action: string; status: 'success' | 'error'; error?: string }[] = [];
    
    constructor() { }

    private logQuota(provider: string, model: string, action: string, status: 'success' | 'error', error?: string) {
        const log = { timestamp: Date.now(), provider, model, action, status, error };
        this.quotaLogs.push(log);
        
        // Keep only last 100 logs in memory
        if (this.quotaLogs.length > 100) {
            this.quotaLogs.shift();
        }

        // Log to console in development
        if (process.env.NODE_ENV !== 'production') {
            const emoji = status === 'success' ? '✅' : '❌';
            console.log(`[QUOTA] ${emoji} ${provider}/${model} - ${action} - ${status}${error ? ` (${error})` : ''}`);
        }
    }

    getQuotaStats() {
        const now = Date.now();
        const last24h = this.quotaLogs.filter(log => now - log.timestamp < 24 * 60 * 60 * 1000);
        
        return {
            total: last24h.length,
            success: last24h.filter(log => log.status === 'success').length,
            errors: last24h.filter(log => log.status === 'error').length,
            byProvider: last24h.reduce((acc, log) => {
                acc[log.provider] = (acc[log.provider] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        };
    }

    /**
     * Resilient execution wrapper with exponential retry.
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        options: { 
            retries: number; 
            baseDelay: number; 
            name: string; 
            provider?: string;
            model?: string;
            action?: string;
            onRetry?: (attempt: number, error: any) => void; 
            onFallback?: (error: any) => void 
        } = { retries: 3, baseDelay: 1000, name: 'AI Operation' }
    ): Promise<T> {
        let lastError: any;
        for (let i = 0; i < options.retries; i++) {
            try {
                const result = await operation();
                
                // Log successful operation
                if (options.provider && options.model && options.action) {
                    this.logQuota(options.provider, options.model, options.action, 'success');
                }
                
                return result;
            } catch (error: any) {
                lastError = error;
                const status = error.status || (error.response && error.response.status) || (error instanceof Response ? error.status : 0);
                const isRetryable = status === 429 || status >= 500 || error.message?.toLowerCase().includes('fetch') || error.message?.toLowerCase().includes('timeout') || error.message?.toLowerCase().includes('network');

                // Log error
                if (options.provider && options.model && options.action) {
                    this.logQuota(options.provider, options.model, options.action, 'error', error.message);
                }

                if (!isRetryable || i === options.retries - 1) {
                    if (options.onFallback) options.onFallback(error);
                    throw error;
                }

                if (options.onRetry) options.onRetry(i + 1, error);

                const delay = options.baseDelay * Math.pow(2, i);
                console.warn(`[AiService] ${options.name} failed (attempt ${i + 1}/${options.retries}). Retrying in ${delay}ms... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    // --- Public "Smart" Methods ---

    async generateText(prompt: string, history: any[], isAuthenticated: boolean, googleKey?: string, pollinationsKey?: string, unusedModel?: string, onStrategyRetry?: (strategy: string, attempt: number) => void, onFallback?: (strategy: string) => void): Promise<string> {
        const errors: string[] = [];
        const gKey = googleKey || (isAuthenticated ? process.env.GOOGLE_API_KEY : undefined);
        const pKey = pollinationsKey || (isAuthenticated ? process.env.POLLINATIONS_TOKEN : undefined);
        const puterToken = isAuthenticated ? process.env.PUTER_TOKEN : undefined;

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
                }, { 
                    retries: 2, 
                    baseDelay: 1000, 
                    name: strategy.name,
                    provider: strategy.type,
                    model: strategy.model,
                    action: 'generate_text',
                    onRetry: (attempt) => onStrategyRetry?.(strategy.name, attempt),
                    onFallback: () => onFallback?.(strategy.name)
                });

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

    async generateAudio(text: string, voice: string, genre: string, lang: string, isAuthenticated: boolean, googleKey?: string, pollinationsKey?: string, openaiKey?: string): Promise<string> {
        const errors: string[] = [];

        const gKey = googleKey || (isAuthenticated ? process.env.GOOGLE_API_KEY : undefined);
        const pKey = pollinationsKey || (isAuthenticated ? process.env.POLLINATIONS_TOKEN : undefined);
        const oKey = openaiKey || (isAuthenticated ? process.env.OPENAI_API_KEY : undefined);

        // 1. Try Pollinations 
        try {
            return await this.withRetry(() => this.generatePollinationsAudio(text, voice, genre, pKey),
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
        if (gKey) {
            try {
                return await this.withRetry(() => this.generateGeminiAudio(text, gKey),
                    { retries: 2, baseDelay: 500, name: 'Gemini Audio' });
            } catch (e: any) {
                console.warn("[AiService] Gemini Audio failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        throw new Error(`All Audio providers failed: ${errors.join(", ")}`);
    }

    async generateImage(prompt: string, isAuthenticated: boolean, googleKey?: string): Promise<string> {
        const errors: string[] = [];
        const gKey = googleKey || (isAuthenticated ? process.env.GOOGLE_API_KEY : undefined);
        
        // 1. Try Gemini (Imagen 3 via Gemini Flash)
        if (gKey) {
            try {
                return await this.withRetry(() => this.generateGeminiImage(prompt, gKey),
                    { retries: 2, baseDelay: 1500, name: 'Gemini Image' });
            } catch (e: any) {
                console.warn("[AiService] Gemini Image failed:", e.message);
                errors.push(`Gemini: ${e.message}`);
            }
        }

        // 2. Try Puter AI (High Reliability Fallback - Requires PUTER_TOKEN)
        const puterToken = isAuthenticated ? process.env.PUTER_TOKEN : undefined;
        if (puterToken) {
            try {
                return await this.withRetry(() => this.generatePuterImage(prompt, puterToken),
                    { retries: 2, baseDelay: 1000, name: 'Puter Image' });
            } catch (e: any) {
                console.warn("[AiService] Puter Image failed:", e.message);
                errors.push(`Puter: ${e.message}`);
            }
        }

        // 3. Try HuggingFace Inference API (FREE - 1000 requests/day)
        const hfToken = isAuthenticated ? process.env.HUGGINGFACE_TOKEN : undefined;
        if (hfToken) {
            try {
                return await this.withRetry(() => this.generateHuggingFaceImage(prompt, hfToken),
                    { retries: 2, baseDelay: 2000, name: 'HuggingFace SDXL' });
            } catch (e: any) {
                console.warn("[AiService] HuggingFace Image failed:", e.message);
                errors.push(`HuggingFace: ${e.message}`);
            }
        }

        const pKey = isAuthenticated ? process.env.POLLINATIONS_TOKEN : undefined;

        // 4. Try Pollinations (Flux) - Main Strategy
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'flux', pKey),
                { retries: 2, baseDelay: 2000, name: 'Pollinations Flux' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations Flux failed:", e.message);
            errors.push(`Pollinations (Flux): ${e.message}`);
        }

        // 5. Try Pollinations (Turbo) - High Availability Fallback
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'turbo', pKey),
                { retries: 2, baseDelay: 2000, name: 'Pollinations Turbo' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations Turbo failed:", e.message);
            errors.push(`Pollinations (Turbo): ${e.message}`);
        }

        // 6. Try Pollinations (Stable Diffusion XL) - Legacy Fallback
        try {
            return await this.withRetry(() => this.generatePollinationsImage(prompt, 'stable-diffusion-xl', pKey),
                { retries: 1, baseDelay: 1000, name: 'Pollinations SDXL' });
        } catch (e: any) {
            console.warn("[AiService] Pollinations SDXL failed:", e.message);
            errors.push(`Pollinations (SDXL): ${e.message}`);
        }

        // 7. Try Legacy Pollinations Endpoint (No Token Required)
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

    private async generatePollinationsImage(prompt: string, model: string = 'flux', token?: string): Promise<string> {
        const encodedPrompt = encodeURIComponent(prompt);
        const seed = Math.floor(Math.random() * 10000);

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

    async generateGameTurn(prompt: string, history: any[], genre: string, isAuthenticated: boolean, googleKey?: string, pollinationsKey?: string, onStrategyRetry?: (strategy: string, attempt: number) => void, onFallback?: (strategy: string) => void): Promise<any> {
        const gKey = googleKey || (isAuthenticated ? process.env.GOOGLE_API_KEY : undefined);
        const pKey = pollinationsKey || (isAuthenticated ? process.env.POLLINATIONS_TOKEN : undefined);
        const puterToken = isAuthenticated ? process.env.PUTER_TOKEN : undefined;

        const systemPrompt = `You are an immersive game engine for a ${genre} adventure.
Your task: Generate ONLY a JSON object for the next game state. Nothing else.

STRICT RULES:
1. Output ONLY valid JSON - no text before or after
2. Start with { and end with }
3. NO markdown code blocks (no \`\`\`)
4. NO conversational text, greetings, or explanations
5. NO asterisks for emphasis (*word* is FORBIDDEN) - use plain text
6. Write narrative in clean, flowing prose without formatting symbols

REQUIRED JSON SCHEMA:
{
  "paragraphs": ["First paragraph of narrative...", "Second paragraph if needed..."],
  "options": ["Action choice 1", "Action choice 2", "Action choice 3"],
  "inventory_changes": ["+item gained", "-item lost"],
  "stats_update": {"health": 100, "gold": 50}
}

FIELD REQUIREMENTS:
- paragraphs: Array of 1-3 strings. Each string is a narrative paragraph (50-150 words). Plain text only, no formatting.
- options: Array of 2-4 strings. Each is a short action the player can take (5-15 words).
- inventory_changes: Array of strings with +/- prefix, or empty array [].
- stats_update: Object with stat changes, or empty object {}.

EXAMPLE OUTPUT:
{"paragraphs":["The ancient door creaks open, revealing a vast chamber lit by flickering torches."],"options":["Enter cautiously","Search for traps","Call out into the darkness"],"inventory_changes":[],"stats_update":{}}

Remember: PURE JSON ONLY. Your response must be parseable by JSON.parse() directly.`;

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
                }, { 
                    retries: 2, 
                    baseDelay: 1000, 
                    name: strategy.name,
                    provider: strategy.type,
                    model: strategy.model,
                    action: 'game_turn',
                    onRetry: (attempt) => onStrategyRetry?.(strategy.name, attempt),
                    onFallback: () => onFallback?.(strategy.name)
                });

                // Use robust parser
                const parsed = this.parseGameTurnResponse(result, strategy.name);
                if (parsed) {
                    return parsed;
                }
                
                // If parsing failed, continue to next strategy
                console.warn(`[AiService] Parsing failed for ${strategy.name}, trying next...`);
                
            } catch (e: any) {
                console.warn(`[AiService] Game Turn strategy ${strategy.name} failed: ${e.message}`);
            }
        }

        throw new Error("Failed to generate structured game turn with all providers.");
    }

    /**
     * Robust parser for game turn responses.
     * Handles various AI response formats, strips preambles, normalizes structure.
     */
    private parseGameTurnResponse(rawResult: string, strategyName: string): any | null {
        try {
            let result = rawResult;

            // 0. Strip markdown code blocks FIRST (very common)
            result = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '');

            // 1. Strip common AI preambles (before any JSON)
            const preamblePatterns = [
                /^.*?(?:aqu[íi]\s+tienes?|here\s+(?:is|are)|let\s+me|i'?ll\s+(?:create|generate)|sure[,!]?\s*(?:here)?|okay[,!]?\s*(?:here)?|certainly[,!]?\s*)/i,
                /^.*?(?:la\s+escena|the\s+scene|your\s+(?:scene|adventure|story))[^{]*/i,
                /^[^{]*?(?::\s*)/,  // Anything ending with colon before JSON
            ];

            for (const pattern of preamblePatterns) {
                const match = result.match(pattern);
                if (match && result.indexOf('{') > match[0].length - 20) {
                    // Only strip if the preamble is actually before the JSON
                    const jsonStart = result.indexOf('{');
                    if (jsonStart > 0) {
                        console.log(`[AiService] Stripping preamble: "${result.substring(0, Math.min(50, jsonStart))}..."`);
                        result = result.substring(jsonStart);
                    }
                    break;
                }
            }

            // 2. Extract JSON block (first { to last })
            const firstBrace = result.indexOf('{');
            const lastBrace = result.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
                // No valid JSON structure found - wrap raw text
                console.warn(`[AiService] No JSON found in response. Wrapping as paragraphs.`);
                return this.wrapTextAsGameTurn(rawResult);
            }

            const jsonPart = result.substring(firstBrace, lastBrace + 1);
            
            // 3. Try to parse JSON
            let parsed: any;
            try {
                parsed = JSON.parse(jsonPart);
            } catch (jsonError) {
                // Try to fix common JSON issues
                let fixedJson = jsonPart
                    .replace(/,\s*}/g, '}')  // Trailing commas
                    .replace(/,\s*]/g, ']')  // Trailing commas in arrays
                    .replace(/'/g, '"')       // Single quotes to double
                    .replace(/[\r\n]+/g, ' ') // Newlines to spaces
                    .replace(/\t/g, ' ')      // Tabs to spaces
                    .replace(/\\/g, '\\\\')   // Escape backslashes
                    .replace(/[\x00-\x1F]/g, ' '); // Control characters to spaces
                
                try {
                    parsed = JSON.parse(fixedJson);
                    console.log(`[AiService] JSON fixed and parsed successfully`);
                } catch {
                    // Last resort: try to extract with regex
                    console.warn(`[AiService] JSON Parse failed. Attempting regex extraction...`);
                    const extracted = this.extractFieldsWithRegex(rawResult);
                    if (extracted) {
                        console.log(`[AiService] Regex extraction succeeded`);
                        return this.normalizeGameTurn(extracted);
                    }
                    console.warn(`[AiService] All parsing failed. Raw: ${jsonPart.substring(0, 100)}...`);
                    return this.wrapTextAsGameTurn(rawResult);
                }
            }

            // 4. Normalize the structure
            const normalized = this.normalizeGameTurn(parsed);
            
            // 5. Post-process: clean markdown artifacts from text fields
            normalized.paragraphs = normalized.paragraphs.map((p: string) => this.cleanMarkdownArtifacts(p));
            normalized.options = normalized.options.map((o: string) => this.cleanMarkdownArtifacts(o));
            
            console.log(`[AiService] Successfully parsed game turn from ${strategyName}`);
            return normalized;

        } catch (e: any) {
            console.error(`[AiService] parseGameTurnResponse exception: ${e.message}`);
            return null;
        }
    }

    /**
     * Clean markdown artifacts from AI text, converting to plain readable text.
     * Converts *text* and **text** to emphasis without symbols.
     */
    private cleanMarkdownArtifacts(text: string): string {
        if (!text || typeof text !== 'string') return text;
        
        return text
            // Convert **bold** to just the text (could add HTML later if needed)
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            // Convert *italic* to just the text
            .replace(/\*([^*]+)\*/g, '$1')
            // Convert __underline__ to just the text
            .replace(/__([^_]+)__/g, '$1')
            // Convert _italic_ to just the text
            .replace(/_([^_]+)_/g, '$1')
            // Remove leftover single asterisks (simplified - avoids lookbehind for compatibility)
            .replace(/([^*])\*([^*])/g, '$1$2')
            // Clean up multiple spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Last resort: extract fields using regex patterns when JSON is malformed.
     */
    private extractFieldsWithRegex(rawText: string): any | null {
        try {
            const result: any = { paragraphs: [], options: [] };
            
            // Try to find paragraphs array content
            const paragraphsMatch = rawText.match(/"paragraphs"\s*:\s*\[([^\]]+)\]/i);
            if (paragraphsMatch) {
                const content = paragraphsMatch[1];
                // Extract quoted strings
                const strings = content.match(/"([^"]+)"/g);
                if (strings) {
                    result.paragraphs = strings.map(s => s.replace(/^"|"$/g, ''));
                }
            }
            
            // Try to find options array content
            const optionsMatch = rawText.match(/"options"\s*:\s*\[([^\]]+)\]/i);
            if (optionsMatch) {
                const content = optionsMatch[1];
                const strings = content.match(/"([^"]+)"/g);
                if (strings) {
                    result.options = strings.map(s => s.replace(/^"|"$/g, ''));
                }
            }
            
            // Only return if we got something useful
            if (result.paragraphs.length > 0 || result.options.length > 0) {
                return result;
            }
            
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Normalize various response structures to our expected format
     */
    private normalizeGameTurn(parsed: any): any {
        const result: any = {
            paragraphs: [],
            options: [],
            inventory_changes: [],
            stats_update: {}
        };

        // Handle paragraphs - can be string, array of strings, or nested
        if (parsed.paragraphs) {
            if (typeof parsed.paragraphs === 'string') {
                result.paragraphs = [parsed.paragraphs];
            } else if (Array.isArray(parsed.paragraphs)) {
                result.paragraphs = parsed.paragraphs.map((p: any) => 
                    typeof p === 'string' ? p : (p.text || p.content || JSON.stringify(p))
                );
            }
        } else if (parsed.paragraph) {
            result.paragraphs = [parsed.paragraph];
        } else if (parsed.text) {
            result.paragraphs = [parsed.text];
        } else if (parsed.content) {
            result.paragraphs = [parsed.content];
        } else if (parsed.description) {
            result.paragraphs = [parsed.description];
        } else if (parsed.narrative) {
            result.paragraphs = [parsed.narrative];
        } else if (parsed.scene) {
            result.paragraphs = [parsed.scene];
        }

        // Handle options - can be string, array of strings, or array of objects
        if (parsed.options) {
            if (typeof parsed.options === 'string') {
                // Try to split by common separators
                result.options = parsed.options.split(/[,;\n]/).map((o: string) => o.trim()).filter((o: string) => o.length > 0);
            } else if (Array.isArray(parsed.options)) {
                result.options = parsed.options.map((o: any) => {
                    if (typeof o === 'string') return o;
                    return o.text || o.label || o.choice || o.option || o.action || JSON.stringify(o);
                });
            }
        } else if (parsed.choices) {
            result.options = Array.isArray(parsed.choices) 
                ? parsed.choices.map((c: any) => typeof c === 'string' ? c : (c.text || c.label || c.choice))
                : [parsed.choices];
        } else if (parsed.actions) {
            result.options = Array.isArray(parsed.actions)
                ? parsed.actions.map((a: any) => typeof a === 'string' ? a : (a.text || a.label || a.action))
                : [parsed.actions];
        }

        // Ensure we always have options
        if (!result.options || result.options.length === 0) {
            result.options = ["Continue", "Look around", "Wait"];
        }

        // Ensure we always have paragraphs
        if (!result.paragraphs || result.paragraphs.length === 0) {
            result.paragraphs = ["The adventure continues..."];
        }

        // Copy over other fields if present
        if (parsed.inventory_changes) result.inventory_changes = parsed.inventory_changes;
        if (parsed.inventory) result.inventory_changes = parsed.inventory;
        if (parsed.stats_update) result.stats_update = parsed.stats_update;
        if (parsed.stats) result.stats_update = parsed.stats;

        return result;
    }

    /**
     * Wrap raw text (when no JSON found) into a valid game turn structure
     */
    private wrapTextAsGameTurn(rawText: string): any {
        // Clean the text - remove common AI preambles
        let cleanedText = rawText
            .replace(/^.*?(?:aqu[íi]\s+tienes?|here\s+(?:is|are)|let\s+me)[^:]*:\s*/i, '')
            .replace(/^.*?(?:la\s+escena|the\s+scene)[^:]*:\s*/i, '')
            .trim();

        // If still has preamble pattern, just take everything after first sentence that looks like preamble
        const preambleEnd = cleanedText.search(/[.!?]\s+[A-ZÁÉÍÓÚ]/);
        if (preambleEnd > 0 && preambleEnd < 100) {
            cleanedText = cleanedText.substring(preambleEnd + 1).trim();
        }

        // Try to extract options from text if they look like a list
        let options = ["Continue", "Look around", "Wait"];
        const optionLines = cleanedText.match(/(?:^|[\n\r])(?:\d+\.|\*|-)\s+([^\n\r]+)/g);
        if (optionLines && optionLines.length >= 2) {
            options = optionLines.map(line => line.replace(/^(?:^|[\n\r])(?:\d+\.|\*|-)\s+/, '').trim()).slice(0, 4);
            // Remove options from paragraphs if they were extracted
            options.forEach(opt => {
                cleanedText = cleanedText.replace(opt, '').trim();
            });
            // Clean up list artifacts
            cleanedText = cleanedText.replace(/(?:\d+\.|\*|-)\s*$/gm, '').trim();
        }

        return {
            paragraphs: [cleanedText || rawText],
            options: options,
            inventory_changes: [],
            stats_update: {}
        };
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

    /**
     * HuggingFace Inference API - FREE tier (1000 requests/day)
     * Uses SDXL for decent quality images with reasonable speed
     */
    private async generateHuggingFaceImage(prompt: string, token: string): Promise<string> {
        // Primary: SDXL Base (best quality/speed balance)
        // Fallback: OpenJourney (faster, MidJourney style)
        const models = [
            "stabilityai/stable-diffusion-xl-base-1.0",
            "prompthero/openjourney"
        ];

        let lastError: any;

        for (const model of models) {
            try {
                console.log(`[AiService] Calling HuggingFace Inference: ${model}`);
                
                // New endpoint as of 2026: router.huggingface.co (api-inference deprecated)
                const response = await fetch(
                    `https://router.huggingface.co/hf-inference/models/${model}`,
                    {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ 
                            inputs: prompt,
                            parameters: {
                                width: 512,
                                height: 768  // Portrait mode for mobile
                            }
                        }),
                    }
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    // Check for model loading (503) - common with HF free tier
                    if (response.status === 503) {
                        console.warn(`[AiService] HuggingFace model ${model} is loading, trying next...`);
                        lastError = new Error(`Model loading: ${errorText}`);
                        continue;
                    }
                    throw new Error(`HuggingFace Status ${response.status}: ${errorText}`);
                }

                const contentType = response.headers.get('content-type') || '';
                
                // HF returns raw image bytes
                if (contentType.includes('image')) {
                    const buffer = await response.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    const mimeType = contentType.includes('png') ? 'image/png' : 'image/jpeg';
                    return `data:${mimeType};base64,${base64}`;
                }

                // Sometimes returns JSON with error or base64
                const json = await response.json();
                if (json.error) {
                    throw new Error(`HuggingFace Error: ${json.error}`);
                }

                throw new Error("Unexpected response format from HuggingFace");

            } catch (e: any) {
                console.warn(`[AiService] HuggingFace model ${model} failed:`, e.message);
                lastError = e;
            }
        }

        throw lastError || new Error("All HuggingFace models failed");
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
