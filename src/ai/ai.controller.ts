import { Controller, Post, Body, Headers, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('text')
    async generateText(
        @Body('prompt') prompt: string,
        @Body('history') history: any[],
        @Body('model') model: string,
        @Headers('x-google-api-key') googleKey: string,
        @Headers('x-pollinations-token') pollinationsKey: string
    ) {
        if (!prompt) throw new BadRequestException('Prompt is required');

        // Sanitize keys: treat "undefined", "null", or empty strings as missing
        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;

        const gHeader = sanitize(googleKey);
        const pHeader = sanitize(pollinationsKey);

        const gKey = gHeader || process.env.GOOGLE_API_KEY;
        const pKey = pHeader || process.env.POLLINATIONS_TOKEN;

        console.log(`[Text] Google Key: ${gHeader ? 'Present (Header)' : 'Missing (Header)'} -> Final: ${gKey ? 'Present (' + gKey.substring(0, 5) + '...)' : 'Missing'}`);
        console.log(`[Text] Pollinations Key: ${pHeader ? 'Present (Header)' : 'Missing (Header)'} -> Final: ${pKey ? 'Present' : 'Missing'}`);

        return {
            text: await this.aiService.generateText(prompt, history || [], gKey, pKey, model)
        };
    }

    @Post('audio')
    async generateAudio(
        @Body('text') text: string,
        @Body('voice') voice: string,
        @Body('genre') genre: string,
        @Body('lang') lang: string,
        @Headers('x-google-api-key') googleKey: string,
        @Headers('x-pollinations-token') pollinationsKey: string,
        @Headers('x-openai-api-key') openaiKey: string
    ) {
        if (!text) throw new BadRequestException('Text is required');

        const sanitize = (k: string) => (!k || k === 'undefined' || k === 'null' || k.trim() === '') ? undefined : k;

        const gKey = sanitize(googleKey) || process.env.GOOGLE_API_KEY;
        const pKey = sanitize(pollinationsKey) || process.env.POLLINATIONS_TOKEN;
        const oKey = sanitize(openaiKey) || process.env.OPENAI_API_KEY;

        console.log(`[Audio] Keys - Google: ${!!gKey}, Pollinations: ${!!pKey}, OpenAI: ${!!oKey}`);

        return {
            audio: await this.aiService.generateAudio(text, voice, genre, lang, gKey, pKey, oKey)
        };
    }

    @Post('image')
    async generateImage(
        @Body('prompt') prompt: string,
        @Headers('x-google-api-key') googleKey: string
    ) {
        if (!prompt) throw new BadRequestException('Prompt is required');

        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        // Pollinations key logic can be added if needed, but service mostly uses free tier for image

        return {
            image: await this.aiService.generateImage(prompt, gKey)
        };
    }
}
