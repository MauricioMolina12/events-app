import type { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '@env/environment';

/**
 * Prepends `environment.apiBaseUrl` to relative requests and enables credentials
 * **once** for the whole app.
 *
 * The session is an `HttpOnly` cookie: the browser attaches it automatically and
 * JavaScript never reads it, so `withCredentials` is the only session plumbing the
 * client needs. Absolute URLs (rare, e.g. an external CDN) are left untouched.
 */
export const baseUrlInterceptor: HttpInterceptorFn = (request, next) => {
  const isAbsolute = /^https?:\/\//i.test(request.url) || request.url.startsWith('//');
  const url = isAbsolute ? request.url : joinUrl(environment.apiBaseUrl, request.url);
  return next(request.clone({ url, withCredentials: true }));
};

function joinUrl(base: string, path: string): string {
  const normalizedPath = path.replace(/^\/+/, '');
  if (!base) {
    return `/${normalizedPath}`;
  }
  return `${base.replace(/\/+$/, '')}/${normalizedPath}`;
}
