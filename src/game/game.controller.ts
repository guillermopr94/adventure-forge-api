import { Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException, Sse, Headers, Header, MessageEvent, Req } from '@nestjs/common';
import { GameService } from './game.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthGuard } from '../auth/auth.guard';

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

    // MongoDB endpoints temporarily disabled - will be re-enabled once we have a valid cluster
    // @Post('save')
    // @UseGuards(AuthGuard)
    // async saveGame(@Req() req: any, @Body() body: SaveGameDto) {
    //     const userId = req.user.googleId;
    //     return this.gameService.saveGame(userId, body);
    // }

    // @Get('list')
    // @UseGuards(AuthGuard)
    // async listGames(@Req() req: any) {
    //     const userId = req.user.googleId;
    //     return this.gameService.listGames(userId);
    // }

    // @Get('load')
    // @UseGuards(AuthGuard)
    // async loadGame(@Req() req: any, @Query('saveId') saveId: string) {
    //     const userId = req.user.googleId;
    //     if (!saveId) throw new UnauthorizedException('Save ID required');
    //     return this.gameService.loadGame(saveId, userId);
    // }

    // @Post('delete')
    // @UseGuards(AuthGuard)
    // async deleteGame(@Req() req: any, @Body() body: { saveId: string }) {
    //     const userId = req.user.googleId;
    //     if (!body.saveId) throw new UnauthorizedException('Save ID required');
    //     return this.gameService.deleteSave(body.saveId, userId);
    // }

    @Post('stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive')
    streamTurn(
        @Req() req: any,
        @Body() body: { prompt: string, history: any[], voice: string, genre: string, lang: string },
        @Headers('x-google-api-key') gKey: string,
        @Headers('x-pollinations-token') pKey: string,
        @Headers('x-openai-api-key') oKey: string
    ): Observable<MessageEvent> {
        // streamTurn might also benefit from userId for history/stats in the future
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
