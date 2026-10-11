import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth-api';
import type { AuthSession, AuthUser, LoginRequest, SignupRequest, UserRole } from './models';
import { SessionEvents } from './session-events';
import { logger } from '@core/utils/logger';

/**
 * Single source of truth for the current session on the client.
 *
 * The session itself is a `HttpOnly` cookie the browser owns; this store only keeps
 * the reflected user/session in memory for guards and chrome, and never persists tokens.
 */
export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly #api = inject(AuthApi);
  readonly #router = inject(Router);
  readonly #events = inject(SessionEvents);

  readonly #user = signal<AuthUser | null>(null);
  readonly #session = signal<AuthSession | null>(null);
  readonly #status = signal<SessionStatus>('unknown');
  #loadPromise: Promise<void> | null = null;
  #redirectInFlight = false;

  readonly user = this.#user.asReadonly();
  readonly session = this.#session.asReadonly();
  readonly status = this.#status.asReadonly();
  readonly isAuthenticated = computed(
    () => this.#status() === 'authenticated' && this.#user() !== null,
  );
  readonly role = computed<UserRole | null>(() => this.#user()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly sessionExpiresAt = computed(() => this.#session()?.expiresAt ?? null);

  constructor() {
    this.#events.unauthorized$.pipe(takeUntilDestroyed()).subscribe((error) => {
      this.#handleUnauthorized(error.code);
    });
  }

  /** Hydrate the reflected session from the browser-owned HttpOnly cookie. */
  load(): Promise<void> {
    if (this.#status() !== 'unknown') {
      return Promise.resolve();
    }
    if (this.#loadPromise) {
      return this.#loadPromise;
    }
    this.#loadPromise = this.#hydrate();
    return this.#loadPromise;
  }

  async login(request: LoginRequest): Promise<AuthUser> {
    const payload = await firstValueFrom(this.#api.login(request));
    this.#setSession(payload);
    return payload.user;
  }

  async signup(request: SignupRequest): Promise<AuthUser> {
    const payload = await firstValueFrom(this.#api.signup(request));
    this.#setSession(payload);
    return payload.user;
  }

  /** Best-effort server logout; local state is cleared even if the call fails. */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.#api.logout());
    } catch (error) {
      logger.warn('Logout request failed; clearing local session anyway', { error: String(error) });
    } finally {
      this.clear();
    }
  }

  clear(): void {
    this.#user.set(null);
    this.#session.set(null);
    this.#status.set('anonymous');
  }

  hasRole(...roles: readonly UserRole[]): boolean {
    const current = this.role();
    return current !== null && roles.includes(current);
  }

  #setSession(payload: { user: AuthUser; session: AuthSession }): void {
    this.#user.set(payload.user);
    this.#session.set(payload.session);
    this.#status.set('authenticated');
  }

  async #hydrate(): Promise<void> {
    try {
      const payload = await firstValueFrom(this.#api.me());
      this.#setSession(payload);
    } catch {
      this.clear();
    } finally {
      this.#loadPromise = null;
    }
  }

  #handleUnauthorized(code: string): void {
    // An unauthorized response while anonymous is not a session that died. Only a reader
    // who was authenticated has a session to lose, so only they are sent back to the login.
    const hadSession = this.#status() === 'authenticated';
    this.clear();
    if (!hadSession || this.#redirectInFlight) {
      return;
    }
    const currentUrl = this.#router.url;
    if (currentUrl.startsWith('/panel/login')) {
      return;
    }
    this.#redirectInFlight = true;
    logger.info('Session ended, redirecting to login', { code });
    void this.#router
      .navigate(['/panel/login'], { queryParams: { returnUrl: currentUrl } })
      .finally(() => {
        this.#redirectInFlight = false;
      });
  }
}
