import { inject } from '@angular/core';
import {
  NavigationEnd,
  NavigationError,
  Router,
  type CanActivateFn,
  type CanMatchFn,
  type GuardResult,
  type UrlTree,
} from '@angular/router';
import { filter, take } from 'rxjs';
import { Splash } from '@core/ui/splash';
import { AuthIntent, redirectToLogin } from './auth-intent';
import type { UserRole } from './models';
import { hasPanelModule, landingPath, panelHome } from './panel-access';
import { SessionStore } from './session-store';

/**
 * Guards are **UX only**: the API validates every request and is the real
 * authorization boundary. They exist so an operator never lands on an empty shell.
 */

async function ensureSessionLoaded(store: SessionStore, splash: Splash): Promise<void> {
  if (store.status() !== 'unknown') {
    return;
  }
  const release = splash.hold('splash.loading');
  try {
    await store.load();
  } finally {
    release();
  }
}

export const authGuard: CanActivateFn = async (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const intent = inject(AuthIntent);
  const splash = inject(Splash);
  await ensureSessionLoaded(store, splash);

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
    const splash = inject(Splash);
    await ensureSessionLoaded(store, splash);

    if (!store.isAuthenticated()) {
      return redirectToLogin(router, intent, state.url);
    }
    if (store.hasRole(...roles)) {
      return true;
    }
    return router.createUrlTree(['/panel/forbidden']);
  };
}

/** Sends an account away from a section its module list does not include. */
export function moduleGuard(module: string): CanActivateFn {
  return async (_route, state) => {
    const store = inject(SessionStore);
    const router = inject(Router);
    const intent = inject(AuthIntent);
    const splash = inject(Splash);
    await ensureSessionLoaded(store, splash);

    if (!store.isAuthenticated()) {
      return redirectToLogin(router, intent, state.url);
    }
    if (hasPanelModule(store.modules(), module)) {
      return true;
    }
    const home = panelHome(store.modules());
    const attempted = state.url.split(/[?#]/)[0] ?? state.url;
    if (attempted === home) {
      return redirectCovered(router, splash, '/panel/forbidden');
    }
    return redirectCovered(router, splash, home);
  };
}

/** Unknown panel addresses go to the first section this account can open. */
export const homeGuard: CanActivateFn = async (_route, state): Promise<GuardResult> => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const intent = inject(AuthIntent);
  const splash = inject(Splash);
  await ensureSessionLoaded(store, splash);
  if (!store.isAuthenticated()) {
    return redirectToLogin(router, intent, state.url);
  }
  return redirectCovered(router, splash, panelHome(store.modules()));
};

/**
 * Keeps a signed-in reader off the login and signup screens.
 * They continue to a pending path they can open, or to their panel home.
 */
export const publicOnlyGuard: CanMatchFn = async () => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const intent = inject(AuthIntent);
  const splash = inject(Splash);
  await ensureSessionLoaded(store, splash);
  if (!store.isAuthenticated()) {
    return true;
  }
  const destination = landingPath(store.modules(), intent.peek());
  intent.clear();
  return redirectCovered(router, splash, destination);
};

/** Keeps the splash up through the navigation a guard just replaced. */
function redirectCovered(router: Router, splash: Splash, url: string): UrlTree {
  const release = splash.hold('splash.loading');
  const timer = setTimeout(release, 4000);
  router.events
    .pipe(
      filter((event) => event instanceof NavigationEnd || event instanceof NavigationError),
      take(1),
    )
    .subscribe(() => {
      clearTimeout(timer);
      release();
    });
  return router.parseUrl(url);
}
