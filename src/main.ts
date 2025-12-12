import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors(); // Allow all CORS for now, can restrict later
    const port = process.env.PORT || 3001;
    await app.listen(port);

    console.log(`Application is running on: ${await app.getUrl()}`);
    console.log(`[Bootstrap] MONGO_URI: ${process.env.MONGO_URI ? 'Defined' : 'Undefined'}`);
    if (process.env.MONGO_URI) {
        // Log veiled URI for safety
        const veiledUri = process.env.MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        console.log(`[Bootstrap] DB Target: ${veiledUri}`);
    }
}
bootstrap();
