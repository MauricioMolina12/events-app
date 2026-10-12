import { Injectable } from '@angular/core';
import {
  RedirectCommand,
  Router,
  type ActivatedRoute,
  type NavigationExtras,
} from '@angular/router';
import { safePanelPath } from './safe-panel-path';

const CONTINUE_KEY = 'continueTo';

/**
 * Where to go after a successful sign-in, without putting that path in the URL.
 *
 * The address bar used to carry `?returnUrl=`. That value is visible, shareable
 * and editable, and a loose check can turn it into an open redirect. The
 * destination now lives in two places the user does not have to understand:
 *
 * - Memory, for the current page load (a protected URL reloads, the guard
 *   records it, then the login screen replaces the address).
 * - `history.state` of the login entry, which the browser restores if that
 *   login screen is reloaded in the same tab.
 *
 * Neither store holds a token. A value is used only after `safePanelPath`
 * accepts it. Reloading the signup screen, or opening login in a new tab,
 * has no destination and falls back to `/panel`.
 */
@Injectable({ providedIn: 'root' })
export class AuthIntent {
  #destination: string | null = null;

  remember(url: string): void {
    const safe = safePanelPath(url);
    if (safe) {
      this.#destination = safe;
    }
  }

  peek(): string {
    return this.#destination ?? continueToFromHistory() ?? '/panel';
  }

  clear(): void {
    this.#destination = null;
    const state = history.state as Record<string, unknown> | null;
    if (!state || typeof state !== 'object' || !(CONTINUE_KEY in state)) {
      return;
    }
    const next = { ...state };
    delete next[CONTINUE_KEY];
    history.replaceState(next, '');
  }
}

export function loginNavigationExtras(url: string): NavigationExtras {
  const continueTo = safePanelPath(url);
  return {
    replaceUrl: true,
    ...(continueTo ? { state: { [CONTINUE_KEY]: continueTo } } : {}),
  };
}

/** Guard result: login, replacing the protected URL so Back does not bounce. */
export function redirectToLogin(
  router: Router,
  intent: AuthIntent,
  attemptedUrl: string,
): RedirectCommand {
  intent.remember(attemptedUrl);
  return new RedirectCommand(router.parseUrl('/panel/login'), loginNavigationExtras(attemptedUrl));
}

/**
 * Drops a legacy `returnUrl` query without reading it as a destination.
 * Old bookmarks must not be able to steer the browser after sign-in.
 */
export function stripLegacyReturnUrl(router: Router, route: ActivatedRoute): void {
  if (!route.snapshot.queryParamMap.has('returnUrl')) {
    return;
  }
  void router.navigate([], {
    relativeTo: route,
    queryParams: { returnUrl: null },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}

function continueToFromHistory(): string | null {
  const state = history.state as Record<string, unknown> | null;
  if (!state || typeof state !== 'object') {
    return null;
  }
  return safePanelPath(state[CONTINUE_KEY]);
}
