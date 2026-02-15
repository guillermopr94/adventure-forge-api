import { Controller, Post, Get, Body, Headers, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('text')
    async generateText(
        @Req() req: any,
        @Body('prompt') prompt: string,
        @Body('history') history: any[],
        @Body('model') model: string,
        @Headers('x-google-api-key') googleKey: string,
        @Headers('x-pollinations-token') pollinationsKey: string
    ) {
        if (!prompt) throw new BadRequestException('Prompt is required');
        const isAuthenticated = !!req.user;

        // Sanitize keys: treat "undefined", "null", or empty strings as missing
        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;

        const gHeader = sanitize(googleKey);
        const pHeader = sanitize(pollinationsKey);

        // Only accept header key if it looks like a valid Gemini API Key (starts with AIza)
        // Otherwise fallback to env key (if authenticated). This prevents OAuth tokens from breaking the call.
        const validGHeader = (gHeader && gHeader.startsWith('AIza')) ? gHeader : undefined;

        console.log(`[Text] Google Header: ${gHeader ? 'Present' : 'Missing'} -> Valid: ${!!validGHeader}, Authenticated: ${isAuthenticated}`);

        return {
            text: await this.aiService.generateText(prompt, history || [], isAuthenticated, validGHeader, pHeader, model)
        };
    }

    @Post('audio')
    async generateAudio(
        @Req() req: any,
        @Body('text') text: string,
        @Body('voice') voice: string,
        @Body('genre') genre: string,
        @Body('lang') lang: string,
        @Headers('x-google-api-key') googleKey: string,
        @Headers('x-pollinations-token') pollinationsKey: string,
        @Headers('x-openai-api-key') openaiKey: string
    ) {
        if (!text) throw new BadRequestException('Text is required');
        const isAuthenticated = !!req.user;

        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;

        const rawGKey = sanitize(googleKey);
        const validGKey = (rawGKey && rawGKey.startsWith('AIza')) ? rawGKey : undefined;
        const pHeader = sanitize(pollinationsKey);
        const oHeader = sanitize(openaiKey);

        console.log(`[Audio] Header Keys - Google: ${!!validGKey}, Pollinations: ${!!pHeader}, OpenAI: ${!!oHeader}, Authenticated: ${isAuthenticated}`);

        return {
            audio: await this.aiService.generateAudio(text, voice, genre, lang, isAuthenticated, validGKey, pHeader, oHeader)
        };
    }

    @Post('batch-audio')
    async generateBatchAudio(
        @Req() req: any,
        @Body('texts') texts: string[],
        @Body('voice') voice: string,
        @Body('genre') genre: string,
        @Body('lang') lang: string,
        @Headers('x-google-api-key') googleKey: string,
        @Headers('x-pollinations-token') pollinationsKey: string,
        @Headers('x-openai-api-key') openaiKey: string
    ) {
        if (!texts || !Array.isArray(texts)) throw new BadRequestException('Texts array is required');
        const isAuthenticated = !!req.user;

        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;

        const rawGKey = sanitize(googleKey);
        const validGKey = (rawGKey && rawGKey.startsWith('AIza')) ? rawGKey : undefined;
        const pHeader = sanitize(pollinationsKey);
        const oHeader = sanitize(openaiKey);

        try {
            const results = await Promise.all(texts.map(async (text) => {
                if (!text.trim()) return null;
                try {
                    return await this.aiService.generateAudio(text, voice, genre, lang, isAuthenticated, validGKey, pHeader, oHeader);
                } catch (e) {
                    console.error(`Batch audio failed for: ${text}`, e);
                    return null;
                }
            }));
            return { audios: results };
        } catch (e) {
            throw new BadRequestException('Batch generation failed');
        }
    }

    @Post('image')
    async generateImage(
        @Req() req: any,
        @Body('prompt') prompt: string,
        @Headers('x-google-api-key') googleKey: string
    ) {
        if (!prompt) throw new BadRequestException('Prompt is required');
        const isAuthenticated = !!req.user;

        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;
        const validGKey = sanitize(googleKey);

        return {
            image: await this.aiService.generateImage(prompt, isAuthenticated, validGKey)
        };
    }

    @Get('quota-stats')
    async getQuotaStats() {
        return this.aiService.getQuotaStats();
    }
}
