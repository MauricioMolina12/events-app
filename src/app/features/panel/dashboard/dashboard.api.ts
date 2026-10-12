import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';
import type { EventStatus } from '@core/domain';

/**
 * Phase computed by the API from the event's status and dates (`GET /dashboard/overview`).
 * An event past its end is `finished` even while it is still `published`.
 */
export type EventPhase =
  | 'draft'
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'finished'
  | 'archived';

export interface OverviewEvent {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly status: EventStatus;
  readonly phase: EventPhase;
  readonly timezone: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly sedes: readonly { readonly participationId: string; readonly name: string }[];
  readonly titulares: number;
  readonly people: number;
  readonly checkedIn: number;
  /** 0..1 */
  readonly attendanceRate: number;
  readonly capacity: number;
  readonly companions: number;
  readonly available: number;
  /** 0 a 100. Se queda por debajo de 100 si todavía hay cupo. */
  readonly occupancy: number;
  readonly occupancyLevel: 'unassigned' | 'normal' | 'high' | 'critical' | 'full';
  readonly client: { readonly id: string; readonly slug: string; readonly displayName: string } | null;
}

export interface DashboardOverview {
  readonly generatedAt: string;
  readonly events: {
    readonly total: number;
    /** Published or closed events that have not ended yet. */
    readonly active: number;
    readonly byStatus: Readonly<Record<EventStatus, number>>;
  };
  /** Most relevant first: in progress, open, upcoming, finished, drafts, archived. */
  readonly items: readonly OverviewEvent[];
  /** Null for an operator: the client total is a platform metric. */
  readonly clients: { readonly total: number } | null;
}

export type TimelineGranularity = 'hour' | 'day' | 'week';

export interface TimelineBucket {
  /** Local date in the event's timezone (`YYYY-MM-DD`); for weeks, the opening Monday. */
  readonly date: string;
  /** Local hour (0-23) when the granularity is `hour`. */
  readonly hour: number | null;
  readonly titulares: number;
  readonly people: number;
  readonly cumulative: number;
}

export interface RegistrationTimeline {
  readonly timezone: string;
  readonly granularity: TimelineGranularity;
  readonly total: number;
  /** Titulares registered in the last 24 hours. */
  readonly last24h: number;
  readonly buckets: readonly TimelineBucket[];
}

export type ActivityItem =
  | {
      readonly type: 'registration';
      readonly at: string;
      readonly registration: {
        readonly id: string;
        readonly fullName: string;
        readonly people: number;
        readonly sede: string;
      };
    }
  | {
      readonly type: 'check_in';
      readonly at: string;
      readonly registration: {
        readonly id: string;
        readonly fullName: string;
        readonly sede: string;
      };
      readonly turn: { readonly first: number; readonly last: number | null };
      readonly operator: string | null;
    }
  | {
      readonly type: 'event_created' | 'event_updated';
      readonly at: string;
      readonly event: { readonly id: string; readonly name: string };
      readonly actor: string | null;
    };

export interface DashboardScope {
  readonly eventId: string;
  readonly participationId?: string;
}

/**
 * Reads that complement `GET /check-in/summary` (reused through `RegistrationDeskApi`):
 * the per-event overview, the registration timeline and the recent activity.
 */
@Injectable({ providedIn: 'root' })
export class DashboardApi {
  readonly #api = inject(ApiClient);

  overview(): Observable<DashboardOverview> {
    return this.#api.get<DashboardOverview>('dashboard/overview');
  }

  timeline(scope: DashboardScope): Observable<RegistrationTimeline> {
    return this.#api.get<RegistrationTimeline>('dashboard/registrations-timeline', {
      eventId: scope.eventId,
      participationId: scope.participationId,
    });
  }

  activity(scope: DashboardScope, limit = 8): Observable<readonly ActivityItem[]> {
    return this.#api.get<readonly ActivityItem[]>('dashboard/activity', {
      eventId: scope.eventId,
      participationId: scope.participationId,
      limit,
    });
  }
}
