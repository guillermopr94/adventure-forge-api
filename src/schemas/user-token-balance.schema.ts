import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * User Token Balance Schema
 * Tracks token balance, refill history, and usage statistics per user
 */
@Schema({ timestamps: true })
export class UserTokenBalance extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0, required: true })
  balance: number;

  @Prop({ type: Date, default: null })
  lastDailyRefill: Date | null;

  @Prop({ type: Number, default: 0, min: 0 })
  totalPurchased: number;

  @Prop({ type: Number, default: 0, min: 0 })
  totalConsumed: number;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UserTokenBalanceSchema = SchemaFactory.createForClass(UserTokenBalance);

// Indexes
UserTokenBalanceSchema.index({ userId: 1 }, { unique: true });

/**
 * TypeScript interface for UserTokenBalance
 */
export interface IUserTokenBalance {
  userId: MongooseSchema.Types.ObjectId;
  balance: number;
  lastDailyRefill: Date | null;
  totalPurchased: number;
  totalConsumed: number;
  createdAt: Date;
  updatedAt: Date;
}
