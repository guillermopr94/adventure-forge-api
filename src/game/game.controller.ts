import { Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException, Sse, Headers, Header, MessageEvent } from '@nestjs/common';
import { GameService } from './game.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Basic DTOs
class SaveGameDto {
    _id?: string;
    userId: string;
    genreKey: string;
    gameHistory: any[];
    gameContent: string[];
    currentOptions?: string[];
    currentImage?: string;
}

@Controller('game')
export class GameController {
    constructor(private readonly gameService: GameService) { }

    @Post('save')
    async saveGame(@Body() body: SaveGameDto) {
        if (!body.userId) throw new UnauthorizedException('User ID required');
        return this.gameService.saveGame(body.userId, body);
    }

    @Get('list')
    async listGames(@Query('userId') userId: string) {
        if (!userId) throw new UnauthorizedException('User ID required');
        return this.gameService.listGames(userId);
    }

    @Get('load')
    async loadGame(@Query('userId') userId: string, @Query('saveId') saveId: string) {
        if (!userId || !saveId) throw new UnauthorizedException('User ID and Save ID required');
        return this.gameService.loadGame(saveId, userId);
    }

    @Post('delete')
    async deleteGame(@Body() body: { userId: string, saveId: string }) {
        if (!body.userId || !body.saveId) throw new UnauthorizedException('User ID and Save ID required');
        return this.gameService.deleteSave(body.saveId, body.userId);
    }

    @Post('stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive')
    streamTurn(
        @Body() body: { prompt: string, history: any[], voice: string, genre: string, lang: string },
        @Headers('x-google-api-key') gKey: string,
        @Headers('x-pollinations-token') pKey: string,
        @Headers('x-openai-api-key') oKey: string
    ): Observable<MessageEvent> {
        return this.gameService.streamTurn(
            body.prompt,
            body.history,
            body.voice,
            body.genre,
            body.lang,
            gKey || process.env.GOOGLE_API_KEY,
            pKey || process.env.POLLINATIONS_TOKEN,
            oKey || process.env.OPENAI_API_KEY
        ).pipe(
            map((data: any) => ({ data: data } as MessageEvent))
        );
    }
}
