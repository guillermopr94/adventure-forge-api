import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema } from 'mongoose';
import { UserTokenBalance } from '../schemas/user-token-balance.schema';
import {
  TokenTransaction,
  TransactionType,
  TransactionMetadata,
} from '../schemas/token-transaction.schema';
import { InsufficientTokensException } from './exceptions/insufficient-tokens.exception';

const DAILY_REFILL_AMOUNT = 10; // Free tier: 10 tokens/day
const REFILL_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Token Economy Service
 * Manages user token balances, transactions, and daily refills
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectModel(UserTokenBalance.name)
    private readonly balanceModel: Model<UserTokenBalance>,
    @InjectModel(TokenTransaction.name)
    private readonly transactionModel: Model<TokenTransaction>,
  ) {}

  /**
   * Get current token balance for a user
   * Creates balance record if it doesn't exist
   */
  async getBalance(userId: string): Promise<number> {
    const balance = await this.balanceModel.findOne({
      userId: new MongooseSchema.Types.ObjectId(userId),
    });

    if (!balance) {
      // Create initial balance record
      const newBalance = await this.balanceModel.create({
        userId: new MongooseSchema.Types.ObjectId(userId),
        balance: 0,
        lastDailyRefill: null,
        totalPurchased: 0,
        totalConsumed: 0,
      });
      return newBalance.balance;
    }

    return balance.balance;
  }

  /**
   * Consume tokens for an action
   * Throws InsufficientTokensException if balance is too low
   */
  async consumeTokens(
    userId: string,
    amount: number,
    metadata: TransactionMetadata,
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const userObjectId = new MongooseSchema.Types.ObjectId(userId);
    const balance = await this.balanceModel.findOne({ userId: userObjectId });

    if (!balance || balance.balance < amount) {
      const available = balance?.balance || 0;
      this.logger.warn(
        `Insufficient tokens for user ${userId}: required ${amount}, available ${available}`,
      );
      throw new InsufficientTokensException(amount, available);
    }

    // Deduct tokens
    balance.balance -= amount;
    balance.totalConsumed += amount;
    await balance.save();

    // Create transaction record
    await this.transactionModel.create({
      userId: userObjectId,
      type: TransactionType.CONSUME,
      amount: -amount,
      description: `Consumed ${amount} tokens for ${metadata.actionType || 'action'}`,
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `User ${userId} consumed ${amount} tokens. New balance: ${balance.balance}`,
    );
  }

  /**
   * Add tokens to user balance
   */
  async addTokens(
    userId: string,
    amount: number,
    type: TransactionType,
    description: string,
    metadata: TransactionMetadata = {},
  ): Promise<void> {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    const userObjectId = new MongooseSchema.Types.ObjectId(userId);
    let balance = await this.balanceModel.findOne({ userId: userObjectId });

    if (!balance) {
      // Create initial balance record
      balance = await this.balanceModel.create({
        userId: userObjectId,
        balance: 0,
        lastDailyRefill: null,
        totalPurchased: 0,
        totalConsumed: 0,
      });
    }

    // Add tokens
    balance.balance += amount;
    if (type === TransactionType.PURCHASE) {
      balance.totalPurchased += amount;
    }
    await balance.save();

    // Create transaction record
    await this.transactionModel.create({
      userId: userObjectId,
      type,
      amount,
      description,
      metadata,
      timestamp: new Date(),
    });

    this.logger.log(
      `User ${userId} received ${amount} tokens (${type}). New balance: ${balance.balance}`,
    );
  }

  /**
   * Check if user has enough tokens
   */
  async hasEnoughTokens(userId: string, required: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= required;
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string,
    limit = 50,
  ): Promise<TokenTransaction[]> {
    return this.transactionModel
      .find({ userId: new MongooseSchema.Types.ObjectId(userId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Daily refill for all eligible users
   * Refills users who haven't received a refill in the last 24 hours
   */
  async dailyRefillAll(): Promise<{ usersRefilled: number }> {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - REFILL_COOLDOWN_MS);

    this.logger.log('Starting daily token refill...');

    // Find users eligible for refill (lastDailyRefill is null or older than 24h)
    const eligibleBalances = await this.balanceModel.find({
      $or: [
        { lastDailyRefill: null },
        { lastDailyRefill: { $lt: cutoffTime } },
      ],
    });

    let usersRefilled = 0;

    for (const balance of eligibleBalances) {
      try {
        // Add refill tokens
        balance.balance += DAILY_REFILL_AMOUNT;
        balance.lastDailyRefill = now;
        await balance.save();

        // Create transaction record
        await this.transactionModel.create({
          userId: balance.userId,
          type: TransactionType.REFILL,
          amount: DAILY_REFILL_AMOUNT,
          description: `Daily refill: ${DAILY_REFILL_AMOUNT} tokens`,
          metadata: {},
          timestamp: now,
        });

        usersRefilled++;
      } catch (error) {
        this.logger.error(
          `Failed to refill tokens for user ${balance.userId}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Daily refill complete. ${usersRefilled} users refilled with ${DAILY_REFILL_AMOUNT} tokens each.`,
    );

    return { usersRefilled };
  }
}
