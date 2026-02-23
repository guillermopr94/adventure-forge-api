import { Test, TestingModule } from '@nestjs/testing';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { TransactionType } from '../schemas/token-transaction.schema';

describe('TokenController', () => {
  let controller: TokenController;
  let tokenService: jest.Mocked<TokenService>;

  const mockTokenService = {
    getBalance: jest.fn(),
    getTransactionHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokenController],
      providers: [
        {
          provide: TokenService,
          useValue: mockTokenService,
        },
      ],
    }).compile();

    controller = module.get<TokenController>(TokenController);
    tokenService = module.get(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return current balance', async () => {
      const mockUserId = 'user123';
      const mockBalance = 42;
      mockTokenService.getBalance.mockResolvedValue(mockBalance);

      const result = await controller.getBalance({ user: { userId: mockUserId } });

      expect(result).toEqual({ balance: mockBalance });
      expect(tokenService.getBalance).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 0 for new users', async () => {
      const mockUserId = 'newuser';
      mockTokenService.getBalance.mockResolvedValue(0);

      const result = await controller.getBalance({ user: { userId: mockUserId } });

      expect(result).toEqual({ balance: 0 });
    });
  });

  describe('getTransactions', () => {
    it('should return transaction history with default limit', async () => {
      const mockUserId = 'user123';
      const mockTransactions = [
        {
          userId: mockUserId,
          type: TransactionType.CONSUME,
          amount: -5,
          description: 'Test transaction',
          timestamp: new Date(),
        },
      ];
      mockTokenService.getTransactionHistory.mockResolvedValue(mockTransactions as any);

      const result = await controller.getTransactions({ user: { userId: mockUserId } });

      expect(result).toEqual({ transactions: mockTransactions });
      expect(tokenService.getTransactionHistory).toHaveBeenCalledWith(mockUserId, 50);
    });

    it('should return transaction history with custom limit', async () => {
      const mockUserId = 'user123';
      const customLimit = 100;
      mockTokenService.getTransactionHistory.mockResolvedValue([]);

      await controller.getTransactions({ user: { userId: mockUserId } }, customLimit);

      expect(tokenService.getTransactionHistory).toHaveBeenCalledWith(
        mockUserId,
        customLimit,
      );
    });

    it('should handle empty transaction history', async () => {
      const mockUserId = 'user123';
      mockTokenService.getTransactionHistory.mockResolvedValue([]);

      const result = await controller.getTransactions({ user: { userId: mockUserId } });

      expect(result).toEqual({ transactions: [] });
    });
  });

  describe('initiatePurchase', () => {
    it('should return 501 message for starter package', async () => {
      const result = await controller.initiatePurchase(
        { user: { userId: 'user123' } },
        { package: 'starter' },
      );

      expect(result).toEqual({ message: 'Token purchases coming soon' });
    });

    it('should return 501 message for explorer package', async () => {
      const result = await controller.initiatePurchase(
        { user: { userId: 'user123' } },
        { package: 'explorer' },
      );

      expect(result).toEqual({ message: 'Token purchases coming soon' });
    });

    it('should return 501 message for hero package', async () => {
      const result = await controller.initiatePurchase(
        { user: { userId: 'user123' } },
        { package: 'hero' },
      );

      expect(result).toEqual({ message: 'Token purchases coming soon' });
    });

    it('should return 501 message for legend package', async () => {
      const result = await controller.initiatePurchase(
        { user: { userId: 'user123' } },
        { package: 'legend' },
      );

      expect(result).toEqual({ message: 'Token purchases coming soon' });
    });
  });
});
