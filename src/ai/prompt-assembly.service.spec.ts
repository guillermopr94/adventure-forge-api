import { Test, TestingModule } from '@nestjs/testing';
import { PromptAssemblyService } from './prompt-assembly.service';

describe('PromptAssemblyService', () => {
  let service: PromptAssemblyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptAssemblyService],
    }).compile();

    service = module.get<PromptAssemblyService>(PromptAssemblyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildHistoryContext', () => {
    it('should format history with role markers', () => {
      const history = [
        { role: 'user', parts: [{ text: 'Hello' }] },
        { role: 'model', parts: [{ text: 'Hi there!' }] },
      ];
      const result = service.buildHistoryContext(history, 10);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('model');
    });

    it('should respect windowSize', () => {
      const history = [
        { role: 'user', parts: [{ text: '1' }] },
        { role: 'model', parts: [{ text: '2' }] },
        { role: 'user', parts: [{ text: '3' }] },
        { role: 'model', parts: [{ text: '4' }] },
      ];
      const result = service.buildHistoryContext(history, 2);
      expect(result).toHaveLength(2);
      expect(result[0].parts[0].text).toBe('3');
      expect(result[1].parts[0].text).toBe('4');
    });
  });

  describe('getGenreInstructions', () => {
    it('should return fantasy instructions', () => {
      const result = service.getGenreInstructions('fantasy');
      expect(result).toContain('fantasy');
      expect(result).toContain('JSON');
    });

    it('should return default instructions for unknown genre', () => {
      const result = service.getGenreInstructions('unknown');
      expect(result).toContain('adventure');
    });
  });
});
