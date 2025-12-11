import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors(); // Allow all CORS for now, can restrict later
    await app.listen(3001);
    console.log('Application is running on: http://localhost:3001');
}
bootstrap();
