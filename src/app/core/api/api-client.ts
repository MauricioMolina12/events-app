import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { ApiEnvelope, Page, PageMeta } from './envelope';
import { toHttpParamEntries, type QueryParams } from './query-params';

/**
 * The only class in the app allowed to talk to `HttpClient`.
 *
 * Interceptors take care of the base URL, the session cookie and error
 * normalization, so callers pass **relative** paths (`'public/events'`).
 * `ApiClient` unwraps the success envelope: callers receive domain data.
 *
 * Use the `*Page` variants for every paginated listing: `meta` carries the limit
 * and offset actually applied by the server, which must never be assumed.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly #http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.#http
      .get<ApiEnvelope<T>>(path, { params: buildParams(params) })
      .pipe(map((envelope) => envelope.data));
  }

  getPage<T>(path: string, params?: QueryParams): Observable<Page<T>> {
    return this.#http
      .get<ApiEnvelope<readonly T[]>>(path, { params: buildParams(params) })
      .pipe(map((envelope) => toPage(envelope.data, envelope.meta)));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.#http.post<ApiEnvelope<T>>(path, body).pipe(map((envelope) => envelope.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.#http.patch<ApiEnvelope<T>>(path, body).pipe(map((envelope) => envelope.data));
  }

  postForm<T>(path: string, body: FormData): Observable<T> {
    return this.#http.post<ApiEnvelope<T>>(path, body).pipe(map((envelope) => envelope.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.#http.delete<ApiEnvelope<T>>(path).pipe(map((envelope) => envelope.data));
  }
}

function buildParams(params?: QueryParams): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of toHttpParamEntries(params)) {
    httpParams = httpParams.set(key, value);
  }
  return httpParams;
}

function toPage<T>(items: readonly T[], meta: PageMeta | undefined): Page<T> {
  return {
    items,
    meta: meta ?? { total: items.length, limit: items.length, offset: 0 },
  };
}
