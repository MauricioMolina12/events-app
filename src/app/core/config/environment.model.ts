/**
 * Runtime configuration contract. Every environment file must implement it.
 *
 * This shape lives in its own module on purpose: `angular.json` swaps `environment.ts`
 * for `environment.production.ts` at build time, and the swap is applied to the *module
 * specifier*. A `./environment` import inside the production file therefore resolves back
 * to the production file itself, so the shared interface cannot live there.
 *
 * The API session lives in an `HttpOnly` cookie, therefore this app never stores
 * tokens: `apiBaseUrl` is the only endpoint-related setting the client needs.
 */
export interface AppEnvironment {
  /** Human readable environment label (shown in the technical error footer). */
  readonly environmentName: 'development' | 'production';
  /** Versioned API prefix. Relative (`/api/v1`) in dev to reuse the Angular proxy. */
  readonly apiBaseUrl: string;
  /** Support channel shown next to a `requestId` on error screens. */
  readonly supportUrl: string;
  /** Enables the in-app technical panel (request log). Never enable in production. */
  readonly enableDevtools: boolean;
  /** Tenant default timezone. Individual events may override it. */
  readonly defaultTimeZone: string;
  /** Locale used by `Intl` formatters. */
  readonly defaultLocale: string;
  /** Brand label rendered in the PWA chrome and page titles. */
  readonly brandName: string;
}
