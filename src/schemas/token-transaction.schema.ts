import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

/**
 * Transaction type enum
 */
export enum TransactionType {
  PURCHASE = 'purchase',
  CONSUME = 'consume',
  REFILL = 'refill',
  BONUS = 'bonus',
}

/**
 * Action type enum for consumed tokens
 */
export enum ActionType {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
}

/**
 * Transaction metadata for traceability
 */
export interface TransactionMetadata {
  sessionId?: string;
  actionType?: ActionType;
  requestId?: string;
}

/**
 * Token Transaction Schema
 * Immutable audit log for all token-related operations
 */
@Schema({ timestamps: false })
export class TokenTransaction extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, enum: Object.values(TransactionType), required: true })
  type: TransactionType;

  @Prop({ 
    type: Number, 
    required: true,
    validate: {
      validator: (v: number) => v !== 0,
      message: 'Amount cannot be zero',
    },
  })
  amount: number;

  @Prop({ type: String, required: true, maxlength: 200 })
  description: string;

  @Prop({ type: Date, default: Date.now, index: -1 })
  timestamp: Date;

  @Prop({ 
    type: MongooseSchema.Types.Mixed, 
    default: {},
    validate: {
      validator: (v: TransactionMetadata) => {
        if (v.actionType && !Object.values(ActionType).includes(v.actionType)) {
          return false;
        }
        return true;
      },
      message: 'Invalid actionType in metadata',
    },
  })
  metadata: TransactionMetadata;
}

export const TokenTransactionSchema = SchemaFactory.createForClass(TokenTransaction);

// Indexes
TokenTransactionSchema.index({ userId: 1, timestamp: -1 });
TokenTransactionSchema.index({ timestamp: -1 });

/**
 * TypeScript interface for TokenTransaction
 */
export interface ITokenTransaction {
  userId: MongooseSchema.Types.ObjectId;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: Date;
  metadata: TransactionMetadata;
}
