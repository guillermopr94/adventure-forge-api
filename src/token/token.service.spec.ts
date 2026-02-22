import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema } from 'mongoose';
import { TokenService } from './token.service';
import { UserTokenBalance } from '../schemas/user-token-balance.schema';
import {
  TokenTransaction,
  TransactionType,
  ActionType,
} from '../schemas/token-transaction.schema';
import { InsufficientTokensException } from './exceptions/insufficient-tokens.exception';

describe('TokenService', () => {
  let service: TokenService;
  let balanceModel: Model<UserTokenBalance>;
  let transactionModel: Model<TokenTransaction>;

  const mockUserId = '507f1f77bcf86cd799439011';
  const mockUserObjectId = new MongooseSchema.Types.ObjectId(mockUserId);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: getModelToken(UserTokenBalance.name),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getModelToken(TokenTransaction.name),
          useValue: {
            create: jest.fn(),
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            exec: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    balanceModel = module.get<Model<UserTokenBalance>>(
      getModelToken(UserTokenBalance.name),
    );
    transactionModel = module.get<Model<TokenTransaction>>(
      getModelToken(TokenTransaction.name),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return existing balance', async () => {
      const mockBalance = {
        userId: mockUserObjectId,
        balance: 50,
        lastDailyRefill: new Date(),
        totalPurchased: 100,
        totalConsumed: 50,
      };

      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(mockBalance as any);

      const result = await service.getBalance(mockUserId);

      expect(result).toBe(50);
      expect(balanceModel.findOne).toHaveBeenCalledWith({
        userId: expect.any(MongooseSchema.Types.ObjectId),
      });
    });

    it('should create new balance record if not exists', async () => {
      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(balanceModel, 'create').mockResolvedValue({
        userId: mockUserObjectId,
        balance: 0,
        lastDailyRefill: null,
        totalPurchased: 0,
        totalConsumed: 0,
      } as any);

      const result = await service.getBalance(mockUserId);

      expect(result).toBe(0);
      expect(balanceModel.create).toHaveBeenCalledWith({
        userId: expect.any(MongooseSchema.Types.ObjectId),
        balance: 0,
        lastDailyRefill: null,
        totalPurchased: 0,
        totalConsumed: 0,
      });
    });
  });

  describe('consumeTokens', () => {
    it('should consume tokens successfully', async () => {
      const mockBalance = {
        userId: mockUserObjectId,
        balance: 50,
        totalConsumed: 10,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(mockBalance as any);
      jest.spyOn(transactionModel, 'create').mockResolvedValue({} as any);

      await service.consumeTokens(mockUserId, 10, { actionType: ActionType.TEXT });

      expect(mockBalance.balance).toBe(40);
      expect(mockBalance.totalConsumed).toBe(20);
      expect(mockBalance.save).toHaveBeenCalled();
      expect(transactionModel.create).toHaveBeenCalledWith({
        userId: expect.any(MongooseSchema.Types.ObjectId),
        type: TransactionType.CONSUME,
        amount: -10,
        description: 'Consumed 10 tokens for text',
        metadata: { actionType: ActionType.TEXT },
        timestamp: expect.any(Date),
      });
    });

    it('should throw InsufficientTokensException when balance is too low', async () => {
      const mockBalance = {
        userId: mockUserObjectId,
        balance: 5,
      };

      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(mockBalance as any);

      await expect(
        service.consumeTokens(mockUserId, 10, { actionType: ActionType.TEXT }),
      ).rejects.toThrow(InsufficientTokensException);
    });

    it('should throw error when amount is negative or zero', async () => {
      await expect(
        service.consumeTokens(mockUserId, 0, { actionType: ActionType.TEXT }),
      ).rejects.toThrow('Amount must be positive');

      await expect(
        service.consumeTokens(mockUserId, -10, { actionType: ActionType.TEXT }),
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw InsufficientTokensException when balance does not exist', async () => {
      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(null);

      await expect(
        service.consumeTokens(mockUserId, 10, { actionType: ActionType.TEXT }),
      ).rejects.toThrow(InsufficientTokensException);
    });
  });

  describe('addTokens', () => {
    it('should add tokens to existing balance', async () => {
      const mockBalance = {
        userId: mockUserObjectId,
        balance: 50,
        totalPurchased: 100,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(mockBalance as any);
      jest.spyOn(transactionModel, 'create').mockResolvedValue({} as any);

      await service.addTokens(
        mockUserId,
        20,
        TransactionType.PURCHASE,
        'Purchased 20 tokens',
      );

      expect(mockBalance.balance).toBe(70);
      expect(mockBalance.totalPurchased).toBe(120);
      expect(mockBalance.save).toHaveBeenCalled();
      expect(transactionModel.create).toHaveBeenCalledWith({
        userId: expect.any(MongooseSchema.Types.ObjectId),
        type: TransactionType.PURCHASE,
        amount: 20,
        description: 'Purchased 20 tokens',
        metadata: {},
        timestamp: expect.any(Date),
      });
    });

    it('should create new balance if not exists', async () => {
      const mockNewBalance = {
        userId: mockUserObjectId,
        balance: 0,
        totalPurchased: 0,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(balanceModel, 'findOne').mockResolvedValue(null);
      jest.spyOn(balanceModel, 'create').mockResolvedValue(mockNewBalance as any);
      jest.spyOn(transactionModel, 'create').mockResolvedValue({} as any);

      await service.addTokens(
        mockUserId,
        20,
        TransactionType.REFILL,
        'Daily refill: 20 tokens',
      );

      expect(mockNewBalance.balance).toBe(20);
      expect(balanceModel.create).toHaveBeenCalled();
    });

    it('should throw error when amount is negative or zero', async () => {
      await expect(
        service.addTokens(mockUserId, 0, TransactionType.PURCHASE, 'Test'),
      ).rejects.toThrow('Amount must be positive');

      await expect(
        service.addTokens(mockUserId, -10, TransactionType.PURCHASE, 'Test'),
      ).rejects.toThrow('Amount must be positive');
    });
  });

  describe('hasEnoughTokens', () => {
    it('should return true when balance is sufficient', async () => {
      jest.spyOn(service, 'getBalance').mockResolvedValue(50);

      const result = await service.hasEnoughTokens(mockUserId, 30);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient', async () => {
      jest.spyOn(service, 'getBalance').mockResolvedValue(20);

      const result = await service.hasEnoughTokens(mockUserId, 30);

      expect(result).toBe(false);
    });

    it('should return true when balance equals required amount', async () => {
      jest.spyOn(service, 'getBalance').mockResolvedValue(30);

      const result = await service.hasEnoughTokens(mockUserId, 30);

      expect(result).toBe(true);
    });
  });

  describe('getTransactionHistory', () => {
    it('should return transaction history for user', async () => {
      const mockTransactions = [
        {
          userId: mockUserObjectId,
          type: TransactionType.CONSUME,
          amount: -10,
          description: 'Consumed 10 tokens',
          timestamp: new Date(),
          metadata: {},
        },
        {
          userId: mockUserObjectId,
          type: TransactionType.REFILL,
          amount: 10,
          description: 'Daily refill',
          timestamp: new Date(),
          metadata: {},
        },
      ];

      jest.spyOn(transactionModel, 'exec').mockResolvedValue(mockTransactions as any);

      const result = await service.getTransactionHistory(mockUserId, 10);

      expect(result).toEqual(mockTransactions);
      expect(transactionModel.find).toHaveBeenCalledWith({
        userId: expect.any(MongooseSchema.Types.ObjectId),
      });
      expect(transactionModel.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(transactionModel.limit).toHaveBeenCalledWith(10);
    });

    it('should use default limit of 50 when not specified', async () => {
      jest.spyOn(transactionModel, 'exec').mockResolvedValue([]);

      await service.getTransactionHistory(mockUserId);

      expect(transactionModel.limit).toHaveBeenCalledWith(50);
    });
  });

  describe('dailyRefillAll', () => {
    it('should refill eligible users', async () => {
      const mockBalances = [
        {
          userId: mockUserObjectId,
          balance: 5,
          lastDailyRefill: null,
          save: jest.fn().mockResolvedValue(true),
        },
        {
          userId: new MongooseSchema.Types.ObjectId('507f1f77bcf86cd799439012'),
          balance: 10,
          lastDailyRefill: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          save: jest.fn().mockResolvedValue(true),
        },
      ];

      jest.spyOn(balanceModel, 'find').mockResolvedValue(mockBalances as any);
      jest.spyOn(transactionModel, 'create').mockResolvedValue({} as any);

      const result = await service.dailyRefillAll();

      expect(result.usersRefilled).toBe(2);
      expect(mockBalances[0].balance).toBe(15); // 5 + 10
      expect(mockBalances[1].balance).toBe(20); // 10 + 10
      expect(mockBalances[0].save).toHaveBeenCalled();
      expect(mockBalances[1].save).toHaveBeenCalled();
      expect(transactionModel.create).toHaveBeenCalledTimes(2);
    });

    it('should skip users who received refill recently', async () => {
      const mockBalances = [
        {
          userId: mockUserObjectId,
          balance: 5,
          lastDailyRefill: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          save: jest.fn(),
        },
      ];

      jest.spyOn(balanceModel, 'find').mockResolvedValue([]);

      const result = await service.dailyRefillAll();

      expect(result.usersRefilled).toBe(0);
    });

    it('should handle errors gracefully and continue refilling other users', async () => {
      const mockBalances = [
        {
          userId: mockUserObjectId,
          balance: 5,
          lastDailyRefill: null,
          save: jest.fn().mockRejectedValue(new Error('Database error')),
        },
        {
          userId: new MongooseSchema.Types.ObjectId('507f1f77bcf86cd799439012'),
          balance: 10,
          lastDailyRefill: null,
          save: jest.fn().mockResolvedValue(true),
        },
      ];

      jest.spyOn(balanceModel, 'find').mockResolvedValue(mockBalances as any);
      jest.spyOn(transactionModel, 'create').mockResolvedValue({} as any);

      const result = await service.dailyRefillAll();

      expect(result.usersRefilled).toBe(1); // Only second user refilled
    });
  });
});
