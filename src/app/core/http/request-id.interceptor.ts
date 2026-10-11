import type { HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs';
import { logger } from '@core/utils/logger';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Sends a correlation id and logs the `x-request-id` the API returns so support can
 * trace a report. The id is a hint only: the API's own value wins on errors and is
 * what the UI shows as "código de soporte".
 */
export const requestIdInterceptor: HttpInterceptorFn = (request, next) => {
  const requestId = createRequestId();
  const withId = request.headers.has(REQUEST_ID_HEADER)
    ? request
    : request.clone({ setHeaders: { [REQUEST_ID_HEADER]: requestId } });

  return next(withId).pipe(
    tap((event) => {
      if (event.type === 4 && event.headers.has('x-request-id')) {
        logger.debug('API response', {
          url: event.url,
          status: event.status,
          requestId: event.headers.get('x-request-id'),
        });
      }
    }),
  );
};

function createRequestId(): string {
  const cryptoRef: Crypto | undefined = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `req-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
