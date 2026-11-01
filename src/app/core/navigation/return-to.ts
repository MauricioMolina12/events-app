import { safePanelPath } from '@core/auth/safe-panel-path';
import { isValidSlug } from '@core/utils/ids';

/**
 * Where a public screen may send the reader back.
 *
 * The value travels in router state, which the reader can edit, so it is not trusted.
 * Only an internal panel path or one of the known catalogue pages is accepted. The
 * inscription screen itself is not a return target: that would loop.
 */

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';

const PUBLIC_RETURNS: readonly RegExp[] = [
  /^\/eventos$/,
  new RegExp(`^\\/eventos\\/${SLUG}$`),
  new RegExp(`^\\/clientes\\/${SLUG}\\/eventos$`),
];

export function safeReturnPath(candidate: unknown): string | null {
  const panel = safePanelPath(candidate);
  if (panel) {
    return panel;
  }
  if (typeof candidate !== 'string') {
    return null;
  }
  const path = candidate.trim();
  if (path.length === 0 || path.length > 256) {
    return null;
  }
  if (/[\u0000-\u001F\u007F\\?#]/.test(path) || path.includes('//')) {
    return null;
  }
  return PUBLIC_RETURNS.some((pattern) => pattern.test(path)) ? path : null;
}

export function readReturnTo(state: unknown): string | null {
  if (!state || typeof state !== 'object') {
    return null;
  }
  return safeReturnPath((state as { readonly returnTo?: unknown }).returnTo);
}

/**
 * Public event slug safe to put in a query and to request from the catalog.
 * Anything else is dropped: the receipt must not call the API with an arbitrary string.
 */
export function safeEventSlug(candidate: unknown): string | null {
  if (typeof candidate !== 'string') {
    return null;
  }
  const slug = candidate.trim();
  if (slug.length === 0 || slug.length > 80 || !isValidSlug(slug)) {
    return null;
  }
  return slug;
}
