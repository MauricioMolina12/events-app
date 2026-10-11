import { Injectable } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { ApiError } from '@core/api/api-error';

/**
 * Decouples detection from reaction: `errorInterceptor` notices a dead session and
 * announces it here; `SessionStore` (which would create a DI cycle if the
 * interceptor injected it directly) reacts by clearing state and redirecting.
 *
 * It deliberately has **no dependencies** of its own.
 */
@Injectable({ providedIn: 'root' })
export class SessionEvents {
  readonly #unauthorized = new Subject<ApiError>();
  /** Emits for `UNAUTHENTICATED` / `SESSION_EXPIRED` / `SESSION_REVOKED` only. */
  readonly unauthorized$: Observable<ApiError> = this.#unauthorized.asObservable();

  notifyUnauthorized(error: ApiError): void {
    this.#unauthorized.next(error);
  }
}
