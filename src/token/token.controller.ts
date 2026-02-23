import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { TokenService } from './token.service';
import { PurchaseTokensDto } from './dto/purchase-tokens.dto';

/**
 * Token Economy Controller
 * Provides endpoints for querying token balances, transactions, and purchases
 */
@ApiTags('tokens')
@Controller('user/tokens')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  /**
   * Get current token balance for authenticated user
   */
  @Get('balance')
  @ApiOperation({ summary: 'Get current token balance' })
  @ApiResponse({
    status: 200,
    description: 'Returns current token balance',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'number', example: 42 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBalance(@Request() req): Promise<{ balance: number }> {
    const balance = await this.tokenService.getBalance(req.user.userId);
    return { balance };
  }

  /**
   * Get transaction history for authenticated user
   */
  @Get('transactions')
  @ApiOperation({ summary: 'Get token transaction history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of transactions to return',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated transaction history',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              userId: { type: 'string' },
              type: { type: 'string', enum: ['CONSUME', 'PURCHASE', 'REFILL'] },
              amount: { type: 'number' },
              description: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTransactions(
    @Request() req,
    @Query('limit') limit = 50,
  ): Promise<{ transactions: any[] }> {
    const transactions = await this.tokenService.getTransactionHistory(
      req.user.userId,
      Number(limit),
    );
    return { transactions };
  }

  /**
   * Initiate token purchase (placeholder for Stripe integration)
   */
  @Post('purchase')
  @ApiOperation({ summary: 'Initiate token purchase' })
  @ApiResponse({
    status: 501,
    description: 'Not Implemented - Coming soon',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Token purchases coming soon' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initiatePurchase(
    @Request() req,
    @Body() dto: PurchaseTokensDto,
  ): Promise<{ message: string }> {
    // Placeholder for Stripe integration
    return {
      message: 'Token purchases coming soon',
    };
  }
}
