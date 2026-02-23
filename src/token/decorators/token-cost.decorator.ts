import { SetMetadata } from '@nestjs/common';

export const TOKEN_COST_KEY = 'token_cost';

/**
 * Decorator to specify token cost for an endpoint
 * @param cost Number of tokens to deduct
 * @example
 * ```typescript
 * @TokenCost(2)
 * async streamTurn() { ... }
 * ```
 */
export const TokenCost = (cost: number) => SetMetadata(TOKEN_COST_KEY, cost);
