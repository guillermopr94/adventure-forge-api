import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';
import { TokenModule } from './token/token.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/adventure-forge', {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        }),
        AiModule,
        AuthModule,
        GameModule,
        TokenModule
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
