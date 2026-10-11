import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  type CanActivateFn,
  type CanMatchFn,
} from '@angular/router';
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

export const authGuard: CanActivateFn = async (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  await ensureSessionLoaded(store);

  if (store.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/panel/login'], { queryParams: { returnUrl: state.url } });
};

export function roleGuard(...roles: readonly UserRole[]): CanActivateFn {
  return async (_route, state) => {
    const store = inject(SessionStore);
    const router = inject(Router);
    await ensureSessionLoaded(store);

    if (!store.isAuthenticated()) {
      return router.createUrlTree(['/panel/login'], { queryParams: { returnUrl: state.url } });
    }
    if (store.hasRole(...roles)) {
      return true;
    }
    return router.createUrlTree(['/panel/forbidden']);
  };
}

/** Keeps authenticated users away from the login screen. */
export const publicOnlyGuard: CanMatchFn = async () => {
  const store = inject(SessionStore);
  await ensureSessionLoaded(store);
  return !store.isAuthenticated();
};
