import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from '@core/api/api-client';
import type { LoginRequest, LogoutResponse, SessionPayload, SignupRequest } from './models';

/**
 * Thin translation layer over `/auth/*`. It only knows paths and payload shapes;
 * session state lives in `SessionStore`.
 */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  readonly #api = inject(ApiClient);

  me(): Observable<SessionPayload> {
    return this.#api.get<SessionPayload>('auth/me');
  }

  login(request: LoginRequest): Observable<SessionPayload> {
    return this.#api.post<SessionPayload>('auth/login', request);
  }

  signup(request: SignupRequest): Observable<SessionPayload> {
    return this.#api.post<SessionPayload>('auth/signup', request);
  }

  logout(): Observable<boolean> {
    return this.#api
      .post<LogoutResponse>('auth/logout', {})
      .pipe(map((response) => response.revoked));
  }
}
