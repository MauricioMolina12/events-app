import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Page } from '@core/api';
import { ApiClient } from '@core/api';
import type { Event, EventStatus } from '@core/domain';

export const EVENT_PAGE_SIZE = 20;
export const EVENT_MAX_PAGE_SIZE = 100;

export interface EventListQuery {
  readonly search?: string;
  readonly status?: EventStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface EventFields {
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly timezone: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly registrationOpensAt: string | null;
  readonly registrationClosesAt: string | null;
  readonly capacity: number;
}

export type CreateEventRequest = EventFields;

export interface UpdateEventRequest extends Partial<EventFields> {
  readonly status?: EventStatus;
}

@Injectable({ providedIn: 'root' })
export class EventsApi {
  readonly #api = inject(ApiClient);

  list(query: EventListQuery = {}): Observable<Page<Event>> {
    return this.#api.getPage<Event>('events', {
      search: query.search,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  get(idOrSlug: string): Observable<Event> {
    return this.#api.get<Event>(`events/${encodeURIComponent(idOrSlug)}`);
  }

  create(request: CreateEventRequest): Observable<Event> {
    return this.#api.post<Event>('events', request);
  }

  update(id: string, request: UpdateEventRequest): Observable<Event> {
    return this.#api.patch<Event>(`events/${encodeURIComponent(id)}`, request);
  }
}
