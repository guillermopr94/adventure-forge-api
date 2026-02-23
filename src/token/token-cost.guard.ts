import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from './token.service';
import { TOKEN_COST_KEY } from './decorators/token-cost.decorator';

/**
 * Guard to enforce token deduction before endpoint execution
 * Usage:
 * ```typescript
 * @UseGuards(AuthGuard, TokenCostGuard)
 * @TokenCost(2)
 * async myEndpoint() { ... }
 * ```
 */
@Injectable()
export class TokenCostGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract token cost from metadata
    const cost = this.reflector.getAllAndOverride<number>(TOKEN_COST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @TokenCost decorator, allow execution
    if (cost === undefined) {
      return true;
    }

    // Extract user from request (assumes AuthGuard ran first)
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub || request.user?.id;

    if (!userId) {
      throw new HttpException(
        'Authentication required for token deduction',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check and deduct tokens
    try {
      await this.tokenService.consumeTokens(
        userId,
        cost,
        this.buildMetadata(request),
      );
      return true;
    } catch (error) {
      // InsufficientTokensException from TokenService
      if (error.response?.statusCode === HttpStatus.PAYMENT_REQUIRED) {
        throw error;
      }
      // Re-throw other errors
      throw new HttpException(
        'Token deduction failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Build metadata object for transaction logging
   */
  private buildMetadata(request: any): Record<string, any> {
    const method = request.method;
    const path = request.route?.path || request.url;
    
    return {
      actionType: `${method} ${path}`,
      requestId: request.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };
  }
}
