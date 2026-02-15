import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return true; // Continue as guest
    }

    const token = authHeader.split(' ')[1];
    try {
      const user = await this.authService.validateUser(token);
      request['user'] = user; // Attach user to request if token is valid
    } catch (error) {
      // If token is invalid, we still allow the request but without a user
      console.warn('[OptionalAuthGuard] Invalid token provided, continuing as guest');
    }
    
    return true;
  }
}
