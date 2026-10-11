import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient, type Page } from '@core/api';
import type { Establishment, Participation } from '@core/domain';

export interface CreateParticipationRequest {
  readonly eventId: string;
  readonly establishmentId: string;
  readonly titularCapacity: number;
  readonly companionCapacity: number;
}

export interface UpdateParticipationCapacityRequest {
  readonly titularCapacity: number;
  readonly companionCapacity: number;
}

@Injectable({ providedIn: 'root' })
export class EventConfigurationApi {
  readonly #api = inject(ApiClient);

  listActiveEstablishments(): Observable<Page<Establishment>> {
    return this.#api.getPage<Establishment>('establishments', {
      status: 'active',
      limit: 100,
      offset: 0,
    });
  }

  listParticipations(eventId: string): Observable<Page<Participation>> {
    return this.#api.getPage<Participation>('participations', {
      eventId,
      limit: 100,
      offset: 0,
    });
  }

  createParticipation(request: CreateParticipationRequest): Observable<Participation> {
    return this.#api.post<Participation>('participations', request);
  }

  updateCapacities(
    id: string,
    request: UpdateParticipationCapacityRequest,
  ): Observable<Participation> {
    return this.#api.patch<Participation>(`participations/${encodeURIComponent(id)}`, request);
  }
}
