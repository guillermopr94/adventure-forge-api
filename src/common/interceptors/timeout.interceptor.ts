import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/**
 * Timeout interceptor for SSE stream endpoints.
 * Prevents infinite hangs by enforcing a maximum request duration.
 *
 * @see Issue #127 - Add SSE Stream Timeout Guards
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 30000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          const request = context.switchToHttp().getRequest();
          const path = request.url || 'unknown';

          console.error(
            `[TimeoutInterceptor] Request timeout after ${this.timeoutMs}ms on ${path}`,
          );

          return throwError(
            () =>
              new RequestTimeoutException(
                `Stream timeout after ${this.timeoutMs / 1000}s - please retry`,
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
