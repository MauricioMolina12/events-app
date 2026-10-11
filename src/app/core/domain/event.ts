import type { EstablishmentSummary, PublicEstablishment } from './establishment';

/**
 * Event and participation, hand-mirrored from `events-api`.
 *
 * `EVENT_STATUSES`, `PARTICIPATION_STATUSES` and friends live in `db/schema` on the
 * server and are copied here on purpose: the backend does not share Zod schemas with
 * the client, so this file **is** the client's contract. Dates travel as ISO-8601
 * strings (UTC); `timezone` only tells the UI how to present them.
 *
 * Two audiences share these shapes with different trims:
 * - `Event` / `Participation`: the panel (`/events`, `/participations`), with internal
 *   status, the capacity breakdown and the establishment's own status.
 * - `PublicEvent` / `PublicParticipation`: the catalog (`/public/events`), where the
 *   API already decides who may be registered (`registrationOpen`) and only publishes
 *   what a family needs to pick a sede.
 */

export type EventStatus = 'draft' | 'published' | 'closed' | 'archived';

export type ParticipationStatus = 'open' | 'closed' | 'cancelled';

/** `GET /events` and `GET /events/{idOrSlug}` — panel only. */
export interface Event {
  readonly id: string;
  /** Public identifier: the catalog URL is built from it. */
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  /** IANA zone used to present `startsAt`/`endsAt`; storage stays UTC. */
  readonly timezone: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  /** Cupo general: techo de personas entre todas las sedes (titulares + acompañantes). */
  readonly capacity: number;
  readonly status: EventStatus;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * `GET /participations` — a sede inside an event and the real unit of capacity.
 *
 * `available*` are computed by the API (`capacity - confirmed`) so the client never
 * subtracts: a mismatch between what the UI shows and what the alta accepts would be
 * indistinguishable from a race for whoever is registering.
 */
export interface Participation {
  readonly id: string;
  readonly eventId: string;
  readonly establishmentId: string;
  readonly status: ParticipationStatus;
  readonly titularCapacity: number;
  readonly companionCapacity: number;
  readonly confirmedTitulares: number;
  readonly confirmedCompanions: number;
  /** Cupo libre de titulares. */
  readonly availableTitulares: number;
  /** Cupo libre de acompañantes. */
  readonly availableCompanions: number;
  /** Own window; `null` means it inherits the event's. */
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly checkInOpensAt: string | null;
  readonly checkInClosesAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly establishment: EstablishmentSummary;
}

/**
 * One sede as offered to the public: how to reach it and how much room is left.
 *
 * `registrationOpen` folds the three conditions the alta re-checks (sede open,
 * establishment active, inside the window), which is why the UI never re-derives it.
 */
export interface PublicParticipation {
  readonly id: string;
  readonly establishment: PublicEstablishment;
  readonly availableTitulares: number;
  readonly availableCompanions: number;
  /** Effective window: the sede's own dates when it declares them. */
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly registrationOpen: boolean;
}

/** `GET /public/events` and `GET /public/events/{slug}` — the catalog. */
export interface PublicEvent {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly timezone: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  /** Published sedes; the list endpoint inlines them, so both pages share a shape. */
  readonly participations: readonly PublicParticipation[];
}
