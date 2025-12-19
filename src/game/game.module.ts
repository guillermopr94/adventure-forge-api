import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameSave, GameSaveSchema } from '../schemas/game-save.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: GameSave.name, schema: GameSaveSchema }]),
    ],
    controllers: [GameController],
    providers: [GameService],
})
export class GameModule { }
