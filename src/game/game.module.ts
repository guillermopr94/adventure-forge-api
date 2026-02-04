import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameSave, GameSaveSchema } from '../schemas/game-save.schema';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        // MongoDB disabled until we have a valid cluster
        // MongooseModule.forFeature([{ name: GameSave.name, schema: GameSaveSchema }]),
        AiModule,
        // AuthModule disabled (requires MongoDB)
        // AuthModule
    ],
    controllers: [GameController],
    providers: [GameService],
})
export class GameModule { }
