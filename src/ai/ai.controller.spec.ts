import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('AiController Concurrency', () => {
  let controller: AiController;
  let service: AiService;

  beforeEach(async () => {
    const mockAuthGuard = {
      canActivate: (context: ExecutionContext) => true,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            generateAudio: jest.fn().mockImplementation(async (text) => {
              // Simulate API delay
              await new Promise(resolve => setTimeout(resolve, 50));
              return `audio-for-${text}`;
            }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
  });

  it('generateBatchAudio should process all texts (baseline check)', async () => {
    const texts = ['one', 'two', 'three', 'four', 'five'];
    const result = await controller.generateBatchAudio(
      { user: { id: 'test' } },
      texts,
      'voice',
      'fantasy',
      'en',
      '', '', ''
    );

    expect(result.audios).toHaveLength(5);
    expect(result.audios).toContain('audio-for-one');
    expect(service.generateAudio).toHaveBeenCalledTimes(5);
  });
});
