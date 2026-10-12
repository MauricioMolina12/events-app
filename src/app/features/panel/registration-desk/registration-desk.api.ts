import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient, type Page } from '@core/api';
import type { DocumentType } from '@core/domain';

export type CheckInStatus = 'checked_in' | 'pending';
export type DeskSort = 'registeredAt' | 'fullName' | 'checkedInAt' | 'turn';
export type SortOrder = 'asc' | 'desc';

/** Same definitions as the backend (`GET /check-in/summary`); the client never recomputes them. */
export interface DeskMetrics {
  readonly titulares: number;
  readonly companions: number;
  readonly people: number;
  readonly checkedIn: number;
  readonly pending: number;
  /** 0..1 */
  readonly attendanceRate: number;
  /** Turns handed out, titulares and companions; a companion's turn comes with the titular's scan. */
  readonly turnsIssued: number;
  readonly lastCheckInAt: string | null;
}

export interface DeskSedeMetrics extends DeskMetrics {
  readonly participationId: string;
  readonly establishment: { readonly id: string; readonly name: string; readonly city: string | null };
}

export interface DeskSummary {
  readonly event: { readonly id: string; readonly slug: string; readonly name: string };
  readonly participationId: string | null;
  readonly totals: DeskMetrics;
  readonly sedes: readonly DeskSedeMetrics[];
}

export interface DeskRow {
  /** Folio. */
  readonly id: string;
  readonly fullName: string;
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly companionsCount: number;
  readonly people: number;
  readonly registeredAt: string;
  readonly sede: { readonly id: string; readonly name: string; readonly city: string | null };
  readonly checkIn: {
    readonly status: CheckInStatus;
    readonly at: string | null;
    readonly firstTurn: number | null;
    readonly lastTurn: number | null;
    readonly turnsCount: number;
    readonly operator: { readonly id: string; readonly fullName: string } | null;
  };
}

export interface DeskCompanion {
  readonly id: string;
  readonly fullName: string;
  readonly documentType: DocumentType | null;
  readonly documentNumber: string | null;
}

export interface DeskQuery {
  readonly eventId: string;
  readonly participationId?: string;
  readonly checkIn?: CheckInStatus;
  readonly search?: string;
  readonly sort?: DeskSort;
  readonly order?: SortOrder;
  readonly limit?: number;
  readonly offset?: number;
}

@Injectable({ providedIn: 'root' })
export class RegistrationDeskApi {
  readonly #api = inject(ApiClient);

  summary(eventId: string, participationId?: string): Observable<DeskSummary> {
    return this.#api.get<DeskSummary>('check-in/summary', { eventId, participationId });
  }

  registrations(query: DeskQuery): Observable<Page<DeskRow>> {
    return this.#api.getPage<DeskRow>('check-in/registrations', {
      eventId: query.eventId,
      participationId: query.participationId,
      checkIn: query.checkIn,
      search: query.search,
      sort: query.sort,
      order: query.order,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /** Companions of one inscription. The desk list only carries the count. */
  companions(registrationId: string): Observable<readonly DeskCompanion[]> {
    return this.#api
      .get<{ companions: readonly DeskCompanion[] }>(
        `registrations/${encodeURIComponent(registrationId)}`,
      )
      .pipe(map((detail) => detail.companions));
  }
}
