import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Page } from '@core/api';
import type {
  AddCompanionsRequest,
  CreateRegistrationRequest,
  HolderCredentials,
  PublicEvent,
  PublicHolderRegistration,
  PublicRegistrationReceipt,
} from '@core/domain';

/** Page size the catalog requests by default; it matches the API's own default. */
export const CATALOG_PAGE_SIZE = 12;

/** Mirrors `PUBLIC_EVENT_LIST_MAX_LIMIT`: asking for more is a 400, not a truncation. */
export const CATALOG_MAX_PAGE_SIZE = 50;

/**
 * Filters accepted by `GET /public/events`. The server defaults and clamps every one
 * of them, so the query string is allowed to be partial.
 */
export interface CatalogQuery {
  /** Free text matched against the event's name and slug (`search` on the wire). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Public, unauthenticated surface of the API.
 *
 * Four endpoints exist on that surface — event list, event detail, the alta and the
 * folio lookup — and they are the only ones that work without a session. Everything the
 * catalog needs goes through here, so a contract change has exactly one place to land.
 *
 * The folio lookup (`GET /public/registrations/{id}`) returns the receipt alone: the
 * titular, the document and the count. No contact data, no event/sede names — those are
 * kept only on the device that created the alta. That is deliberate: an id alone must
 * not expose a name and a document number to anyone who guesses one.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  readonly #api = inject(ApiClient);

  listEvents(query: CatalogQuery = {}): Observable<Page<PublicEvent>> {
    return this.#api.getPage<PublicEvent>('public/events', {
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /** `slug` may also be the event id: the API accepts either one. */
  getEvent(slug: string): Observable<PublicEvent> {
    return this.#api.get<PublicEvent>(`public/events/${encodeURIComponent(slug)}`);
  }

  /**
   * Alta. The answer is the receipt the person keeps, not the full registration: the
   * server owns capacity and window, so a success here means the seat is taken.
   */
  createRegistration(request: CreateRegistrationRequest): Observable<PublicRegistrationReceipt> {
    return this.#api.post<PublicRegistrationReceipt>('public/registrations', request);
  }

  /**
   * Folio lookup. The receipt is the only thing a public id may reveal: no contact data,
   * no companions' documents. The confirmation screen uses this as its source of truth
   * so a reload or a shared link still shows the confirmation, not a "not found".
   */
  getRegistration(id: string): Observable<PublicRegistrationReceipt> {
    return this.#api.get<PublicRegistrationReceipt>(
      `public/registrations/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Finds the titular's alta by event, document and email. It is a POST so the document and
   * the email never travel in a URL (logs, history, referrers).
   */
  lookupHolderRegistration(credentials: HolderCredentials): Observable<PublicHolderRegistration> {
    return this.#api.post<PublicHolderRegistration>('public/registrations/lookup', credentials);
  }

  /** Appends companions to an existing alta; the server enforces the per-titular cap. */
  addCompanions(request: AddCompanionsRequest): Observable<PublicHolderRegistration> {
    return this.#api.post<PublicHolderRegistration>('public/registrations/companions', request);
  }
}
