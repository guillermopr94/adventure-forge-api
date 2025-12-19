import { Body, Controller, Get, Post, Query, UseGuards, UnauthorizedException } from '@nestjs/common';
import { GameService } from './game.service';

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
}
