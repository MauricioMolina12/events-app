import { inject } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { toApiError } from '@core/api/api-error';
import { SessionEvents } from '@core/auth/session-events';
import { SESSION_EPOCH, currentSessionEpoch } from '@core/auth/session-epoch';
import { logger } from '@core/utils/logger';

/** Error codes that mean "the session is gone" and force a re-login. */
const SESSION_DEAD_CODES = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED', 'SESSION_REVOKED']);

/**
 * Normalizes every failure into a single `ApiError` so no component ever parses a
 * raw error body, and notifies `SessionEvents` when the session died.
 *
 * `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` and `ACCOUNT_DISABLED` are **not**
 * session-death codes: they belong to the login form and must not trigger a
 * redirect loop.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const sessionEvents = inject(SessionEvents);

  return next(request).pipe(
    catchError((error: unknown) => {
      const apiError = toApiError(error);
      logger.warn('API error', {
        url: request.url,
        status: apiError.status,
        code: apiError.code,
        requestId: apiError.requestId,
      });
      if (
        SESSION_DEAD_CODES.has(apiError.code) &&
        request.context.get(SESSION_EPOCH) === currentSessionEpoch()
      ) {
        sessionEvents.notifyUnauthorized(apiError);
      }
      return throwError(() => apiError);
    }),
  );
};
