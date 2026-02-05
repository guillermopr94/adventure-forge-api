import { Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException, Sse, Headers, Header, MessageEvent, Req, Res } from '@nestjs/common';
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

    @Post('save')
    @UseGuards(AuthGuard)
    async saveGame(@Req() req: any, @Body() body: SaveGameDto) {
        const userId = req.user.googleId;
        return this.gameService.saveGame(userId, body);
    }

    @Get('list')
    @UseGuards(AuthGuard)
    async listGames(@Req() req: any) {
        const userId = req.user.googleId;
        return this.gameService.listGames(userId);
    }

    @Get('load')
    @UseGuards(AuthGuard)
    async loadGame(@Req() req: any, @Query('saveId') saveId: string) {
        const userId = req.user.googleId;
        if (!saveId) throw new UnauthorizedException('Save ID required');
        return this.gameService.loadGame(saveId, userId);
    }

    @Post('delete')
    @UseGuards(AuthGuard)
    async deleteGame(@Req() req: any, @Body() body: { saveId: string }) {
        const userId = req.user.googleId;
        if (!body.saveId) throw new UnauthorizedException('Save ID required');
        return this.gameService.deleteSave(body.saveId, userId);
    }

    @Post('stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive')
    streamTurn(
        @Req() req: any,
        @Body() body: { prompt: string, history: any[], voice: string, genre: string, lang: string },
        @Headers('x-google-api-key') gKey: string,
        @Headers('x-pollinations-token') pKey: string,
        @Headers('x-openai-api-key') oKey: string,
        @Res() res: any
    ) {
        const stream$ = this.gameService.streamTurn(
            body.prompt,
            body.history,
            body.voice,
            body.genre,
            body.lang,
            gKey || process.env.GOOGLE_API_KEY,
            pKey || process.env.POLLINATIONS_TOKEN,
            oKey || process.env.OPENAI_API_KEY
        );

        const subscription = stream$.subscribe({
            next: (data: any) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            },
            error: (err: any) => {
                console.error('Stream error:', err);
                // Try to send error to client if headers sent, otherwise 500
                if (!res.headersSent) {
                    res.status(500).send(err.message);
                } else {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
                    res.end();
                }
            },
            complete: () => {
                res.end();
            }
        });

        // Handle client disconnect
        req.on('close', () => {
            subscription.unsubscribe();
        });
    }
}
