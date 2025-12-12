import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';

@Module({
    imports: [
        ConfigModule.forRoot(),
        MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost/adventure-forge'),
        AiModule,
        AuthModule
    ],
    controllers: [],
    providers: [],
})
export class AppModule { }
