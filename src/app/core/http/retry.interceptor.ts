import type { HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';
import { toApiError } from '@core/api/api-error';

const RETRYABLE_STATUSES = new Set([0, 408, 429, 502, 503, 504]);
const MAX_RETRIES = 2;

/**
 * Retries **only idempotent GETs** on transport/again-later failures, with
 * exponential backoff + jitter. `POST`/`PATCH` are never retried: a registration or
 * a cancellation must not be replayed behind the operator's back.
 */
export const retryInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method !== 'GET') {
    return next(request);
  }

  return next(request).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: unknown, attempt: number) => {
        const apiError = toApiError(error);
        if (!RETRYABLE_STATUSES.has(apiError.status)) {
          return throwError(() => error);
        }
        const backoff = Math.min(250 * 2 ** (attempt - 1), 2000);
        const jitter = Math.random() * 120;
        return timer(backoff + jitter);
      },
    }),
  );
};
