const PANEL_HOME = '/panel';
const PANEL_ORIGIN = 'https://panel.invalid';
const AUTH_PATHS = new Set(['/panel/login', '/panel/signup']);

/**
 * Accepts only an internal panel path.
 *
 * The value may come from the router or from `history.state`, both of which the
 * user can edit. Anything that is not a same-origin `/panel` path is dropped:
 * other origins, protocol-relative URLs, the login screens themselves (they
 * would loop) and queries that smuggle an absolute URL.
 */
export function safePanelPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string') {
    return null;
  }
  const raw = candidate.trim();
  if (raw.length === 0 || raw.length > 2048) {
    return null;
  }
  if (/[\u0000-\u001F\u007F\\]/.test(candidate) || /[\u0000-\u001F\u007F\\]/.test(raw)) {
    return null;
  }
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw, PANEL_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PANEL_ORIGIN || url.username || url.password) {
    return null;
  }

  let path = url.pathname;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (path.includes('\\') || path.includes('//') || (path !== url.pathname && path.includes('..'))) {
    return null;
  }
  if (path !== PANEL_HOME && !path.startsWith(`${PANEL_HOME}/`)) {
    return null;
  }
  if (AUTH_PATHS.has(path) || [...AUTH_PATHS].some((authPath) => path.startsWith(`${authPath}/`))) {
    return null;
  }
  if (containsAbsoluteUrl(url.search) || containsAbsoluteUrl(url.hash)) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function containsAbsoluteUrl(value: string): boolean {
  return /\/\/|https?:|javascript:/i.test(value);
}
