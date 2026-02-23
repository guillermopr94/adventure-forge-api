import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';
import { TokenCostGuard } from './token-cost.guard';
import { AuthModule } from '../auth/auth.module';
import {
  UserTokenBalance,
  UserTokenBalanceSchema,
} from '../schemas/user-token-balance.schema';
import {
  TokenTransaction,
  TokenTransactionSchema,
} from '../schemas/token-transaction.schema';

/**
 * Token Economy Module
 * Provides token management services for the application
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserTokenBalance.name, schema: UserTokenBalanceSchema },
      { name: TokenTransaction.name, schema: TokenTransactionSchema },
    ]),
    AuthModule,
  ],
  controllers: [TokenController],
  providers: [TokenService, TokenCostGuard],
  exports: [TokenService, TokenCostGuard],
})
export class TokenModule {}
