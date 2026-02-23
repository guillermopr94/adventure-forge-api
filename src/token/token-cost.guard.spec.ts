import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { TokenCostGuard } from './token-cost.guard';
import { TokenService } from './token.service';
import { TOKEN_COST_KEY } from './decorators/token-cost.decorator';

describe('TokenCostGuard', () => {
  let guard: TokenCostGuard;
  let tokenService: TokenService;
  let reflector: Reflector;

  const mockTokenService = {
    consumeTokens: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCostGuard,
        { provide: TokenService, useValue: mockTokenService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<TokenCostGuard>(TokenCostGuard);
    tokenService = module.get<TokenService>(TokenService);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  const createMockContext = (userId?: string, cost?: number): ExecutionContext => {
    mockReflector.getAllAndOverride.mockReturnValue(cost);
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { sub: userId } : undefined,
          method: 'POST',
          route: { path: '/game/stream' },
          url: '/game/stream',
          id: 'req-123',
          ip: '127.0.0.1',
          headers: { 'user-agent': 'test-agent' },
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('No @TokenCost decorator', () => {
    it('should allow execution when no cost metadata', async () => {
      const context = createMockContext('user123');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(tokenService.consumeTokens).not.toHaveBeenCalled();
    });
  });

  describe('With @TokenCost decorator', () => {
    it('should deduct tokens and allow execution', async () => {
      const context = createMockContext('user123', 2);
      mockTokenService.consumeTokens.mockResolvedValue(undefined);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tokenService.consumeTokens).toHaveBeenCalledWith(
        'user123',
        2,
        expect.objectContaining({
          actionType: 'POST /game/stream',
          requestId: 'req-123',
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should throw 401 when user not authenticated', async () => {
      const context = createMockContext(undefined, 2);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException(
          'Authentication required for token deduction',
          HttpStatus.UNAUTHORIZED,
        ),
      );
      expect(tokenService.consumeTokens).not.toHaveBeenCalled();
    });

    it('should throw 402 when insufficient tokens', async () => {
      const context = createMockContext('user123', 2);
      const insufficientError = new HttpException(
        { statusCode: HttpStatus.PAYMENT_REQUIRED, message: 'Insufficient tokens' },
        HttpStatus.PAYMENT_REQUIRED,
      );
      mockTokenService.consumeTokens.mockRejectedValue(insufficientError);

      await expect(guard.canActivate(context)).rejects.toThrow(insufficientError);
    });

    it('should throw 500 on unexpected token service error', async () => {
      const context = createMockContext('user123', 2);
      mockTokenService.consumeTokens.mockRejectedValue(new Error('DB connection failed'));

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException('Token deduction failed', HttpStatus.INTERNAL_SERVER_ERROR),
      );
    });

    it('should handle user.id instead of user.sub', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(2);
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'user456' },
            method: 'POST',
            route: { path: '/game/stream' },
            url: '/game/stream',
            id: 'req-456',
            ip: '192.168.1.1',
            headers: { 'user-agent': 'another-agent' },
          }),
        }),
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as any;

      mockTokenService.consumeTokens.mockResolvedValue(undefined);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tokenService.consumeTokens).toHaveBeenCalledWith(
        'user456',
        2,
        expect.any(String),
        expect.any(Object),
      );
    });
  });
});
