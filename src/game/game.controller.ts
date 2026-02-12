import { Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException, ForbiddenException, Sse, Headers, Header, MessageEvent, Req, Res } from '@nestjs/common';
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
@UseGuards(AuthGuard)
export class GameController {
    constructor(private readonly gameService: GameService) { }

    @Post('save')
    async saveGame(@Req() req: any, @Body() body: SaveGameDto) {
        const userId = req.user.googleId;
        return this.gameService.saveGame(userId, body);
    }

    @Get('list')
    async listGames(@Req() req: any) {
        const userId = req.user.googleId;
        return this.gameService.listGames(userId);
    }

    @Get('load')
    async loadGame(@Req() req: any, @Query('saveId') saveId: string) {
        const userId = req.user.googleId;
        if (!saveId) throw new UnauthorizedException('Save ID required');
        return this.gameService.loadGame(saveId, userId);
    }

    @Post('delete')
    async deleteGame(@Req() req: any, @Body() body: { saveId: string }) {
        const userId = req.user.googleId;
        if (!body.saveId) throw new UnauthorizedException('Save ID required');
        return this.gameService.deleteSave(body.saveId, userId);
    }

    @Post('stream')
    @Header('Content-Type', 'text/event-stream')
    @Header('Cache-Control', 'no-cache')
    @Header('Connection', 'keep-alive')
    async streamTurn(
        @Req() req: any,
        @Body() body: { prompt: string, history: any[], voice: string, genre: string, lang: string, saveId?: string },
        @Headers('x-google-api-key') gKey: string,
        @Headers('x-pollinations-token') pKey: string,
        @Headers('x-openai-api-key') oKey: string,
        @Res() res: any
    ) {
        const userId = req.user.googleId;

        // Verify save ownership if saveId is provided
        if (body.saveId) {
            const save = await this.gameService.loadGame(body.saveId, userId);
            if (!save) {
                console.warn(`[GameController] Unauthorized stream attempt for save ${body.saveId} by user ${userId}`);
                return res.status(403).json({ 
                    type: 'error', 
                    message: 'Forbidden: You do not have permission to access this game save.' 
                });
            }
        }

        const stream$ = this.gameService.streamTurn(
            userId,
            body.prompt,
            body.history,
            body.voice,
            body.genre,
            body.lang,
            !!req.user,
            gKey,
            pKey,
            oKey
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
