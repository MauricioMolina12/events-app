import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api';
import type { AuthSession, AuthUser } from './models';
import { AuthApi } from './auth-api';
import { SessionEvents } from './session-events';
import { SessionStore } from './session-store';

/** Stands in for the real route table; the store only needs a router to exist. */
@Component({ selector: 'app-test-blank', template: '' })
class Blank {}

const USER: AuthUser = {
  id: 'u1',
  email: 'op@example.com',
  fullName: 'Operador',
  role: 'operator',
  status: 'active',
};

const SESSION: AuthSession = { id: 's1', expiresAt: '2026-12-31T00:00:00.000Z' };

describe('SessionStore', () => {
  let api: {
    me: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    signup: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = { me: vi.fn(), login: vi.fn(), signup: vi.fn(), logout: vi.fn() };
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: Blank }]),
        { provide: AuthApi, useValue: api },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function unauthorized(code: 'UNAUTHENTICATED' | 'SESSION_EXPIRED'): ApiError {
    return new ApiError({ status: 401, code, message: 'Nope' });
  }

  it('hydrates an authenticated session from the HttpOnly cookie probe', async () => {
    const store = TestBed.inject(SessionStore);
    api.me.mockReturnValue(of({ user: USER, session: SESSION }));

    await store.load();

    expect(api.me).toHaveBeenCalledOnce();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.user()).toEqual(USER);
    expect(store.session()).toEqual(SESSION);
  });

  it('does not redirect an anonymous visitor when an unauthorized response arrives', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const store = TestBed.inject(SessionStore);

    TestBed.inject(SessionEvents).notifyUnauthorized(unauthorized('UNAUTHENTICATED'));

    expect(store.status()).toBe('anonymous');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('returns an authenticated reader to the login when their session dies', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const store = TestBed.inject(SessionStore);
    api.login.mockReturnValue(of({ user: USER, session: SESSION }));

    await store.login({ email: USER.email, password: 'secret' });
    TestBed.inject(SessionEvents).notifyUnauthorized(unauthorized('SESSION_EXPIRED'));

    expect(store.status()).toBe('anonymous');
    expect(navigate).toHaveBeenCalledWith(['/panel/login'], { replaceUrl: true });
  });

  it('stores the operator session returned by signup', async () => {
    const store = TestBed.inject(SessionStore);
    api.signup.mockReturnValue(of({ user: USER, session: SESSION }));

    const user = await store.signup({
      email: USER.email,
      fullName: USER.fullName,
      password: 'a-secure-password',
    });

    expect(user).toEqual(USER);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('operator');
    expect(store.session()).toEqual(SESSION);
  });
});
