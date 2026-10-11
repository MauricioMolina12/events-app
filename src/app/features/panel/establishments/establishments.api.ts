import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Page } from '@core/api';
import { ApiClient } from '@core/api';
import type { Establishment, EstablishmentStatus } from '@core/domain';

export const ESTABLISHMENT_PAGE_SIZE = 20;
export const ESTABLISHMENT_MAX_PAGE_SIZE = 100;

export interface EstablishmentListQuery {
  readonly search?: string;
  readonly status?: EstablishmentStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CreateEstablishmentRequest {
  readonly code: string;
  readonly name: string;
  readonly city: string | null;
  readonly address: string | null;
}

export interface UpdateEstablishmentRequest {
  readonly name?: string;
  readonly city?: string | null;
  readonly address?: string | null;
  readonly status?: EstablishmentStatus;
}

@Injectable({ providedIn: 'root' })
export class EstablishmentsApi {
  readonly #api = inject(ApiClient);

  list(query: EstablishmentListQuery = {}): Observable<Page<Establishment>> {
    return this.#api.getPage<Establishment>('establishments', {
      search: query.search,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  get(id: string): Observable<Establishment> {
    return this.#api.get<Establishment>(`establishments/${encodeURIComponent(id)}`);
  }

  create(request: CreateEstablishmentRequest): Observable<Establishment> {
    return this.#api.post<Establishment>('establishments', request);
  }

  update(id: string, request: UpdateEstablishmentRequest): Observable<Establishment> {
    return this.#api.patch<Establishment>(`establishments/${encodeURIComponent(id)}`, request);
  }
}
