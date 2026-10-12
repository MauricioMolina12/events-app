import { inject } from '@angular/core';
import { Router, type CanActivateFn, type CanMatchFn } from '@angular/router';
import { AuthIntent, redirectToLogin } from './auth-intent';
import { SessionStore } from './session-store';
import type { UserRole } from './models';

/**
 * Guards are **UX only**: the API validates every request and is the real
 * authorization boundary. They exist so an operator never lands on an empty shell.
 */

async function ensureSessionLoaded(store: SessionStore): Promise<void> {
  if (store.status() === 'unknown') {
    await store.load();
  }
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const intent = inject(AuthIntent);
  await ensureSessionLoaded(store);

  if (store.isAuthenticated()) {
    return true;
  }
  return redirectToLogin(router, intent, state.url);
};

export function roleGuard(...roles: readonly UserRole[]): CanActivateFn {
  return async (_route, state) => {
    const store = inject(SessionStore);
    const router = inject(Router);
    const intent = inject(AuthIntent);
    await ensureSessionLoaded(store);

    if (!store.isAuthenticated()) {
      return redirectToLogin(router, intent, state.url);
    }
    if (store.hasRole(...roles)) {
      return true;
    }
    return router.createUrlTree(['/panel/forbidden']);
  };
}

/**
 * Keeps a signed-in reader off the login and signup screens.
 * They continue to the pending panel path, or to the panel home.
 */
export const publicOnlyGuard: CanMatchFn = async () => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const intent = inject(AuthIntent);
  await ensureSessionLoaded(store);
  if (!store.isAuthenticated()) {
    return true;
  }
  const destination = intent.peek();
  intent.clear();
  return router.parseUrl(destination);
};
