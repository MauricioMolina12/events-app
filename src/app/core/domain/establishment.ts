/**
 * A physical place where an event is hosted ("sede"), mirrored from `events-api`.
 *
 * `code` is the short identifier the operation uses (sheets, reports) and travels as
 * is; `name` is what the public sees. The catalog never receives the full row, only
 * `PublicEstablishment`.
 */

export type EstablishmentStatus = 'active' | 'inactive';

/** `GET /establishments` and `GET /establishments/{id}` — panel only. */
export interface Establishment {
  readonly id: string;
  /** Minúsculas, dígitos y guiones simples. */
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly address: string | null;
  readonly status: EstablishmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Trimmed form the API embeds when a sede accompanies another entity. */
export interface EstablishmentSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly status: EstablishmentStatus;
}

/** Sede as published in the catalog: enough to recognise it and get there. */
export interface PublicEstablishment {
  readonly id: string;
  readonly name: string;
  readonly city: string | null;
}
