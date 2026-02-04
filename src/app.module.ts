import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost/adventure-forge', {
            serverSelectionTimeoutMS: 5000, // Timeout después de 5 segundos
            socketTimeoutMS: 10000,
            connectTimeoutMS: 10000,
            // No bloquear el inicio si MongoDB falla
            // La app funcionará para /game/stream pero fallará para saves/loads
        }),
        AiModule,
        AuthModule,
        GameModule
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
