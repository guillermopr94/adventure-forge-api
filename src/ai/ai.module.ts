import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PromptAssemblyService } from './prompt-assembly.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        AuthModule
    ],
    controllers: [AiController],
    providers: [AiService, PromptAssemblyService],
    exports: [AiService, PromptAssemblyService],
})
export class AiModule { }
