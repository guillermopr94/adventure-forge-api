import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Optional authentication guard that validates tokens when present
 * but allows requests without authentication to proceed.
 * 
 * Sets request.user when a valid token is provided.
 * Leaves request.user undefined for unauthenticated requests.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // No auth header? Allow the request, but user will be undefined
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      request['user'] = undefined;
      return true;
    }

    const token = authHeader.split(' ')[1];
    try {
      // Try to validate the token
      const user = await this.authService.validateUser(token);
      request['user'] = user;
      return true;
    } catch (error) {
      // Invalid token? Still allow the request, but user is undefined
      // This prevents breaking the app for malformed tokens
      console.warn('OptionalAuth: Invalid token provided, proceeding as guest');
      request['user'] = undefined;
      return true;
    }
  }
}
