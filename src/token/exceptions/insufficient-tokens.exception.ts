import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Exception thrown when user has insufficient tokens for an operation
 */
export class InsufficientTokensException extends HttpException {
  constructor(required: number, available: number) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Insufficient Tokens',
        message: `Insufficient tokens. Required: ${required}, Available: ${available}`,
        required,
        available,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
