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
        // Fallback to env vars if headers missing
        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;

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

        const gKey = googleKey || process.env.GOOGLE_API_KEY;
        const pKey = pollinationsKey || process.env.POLLINATIONS_TOKEN;
        const oKey = openaiKey || process.env.OPENAI_API_KEY;

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
