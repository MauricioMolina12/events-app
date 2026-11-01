import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';

/** Espacio de un operador. No incluye el correo de la cuenta. */
export interface ClientSpace {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly nameCustomized: boolean;
  readonly primaryColor: string;
  readonly colorCustomized: boolean;
  readonly status: 'active' | 'disabled';
}

export interface ClientPatch {
  readonly displayName?: string;
  readonly primaryColor?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientsApi {
  readonly #api = inject(ApiClient);

  /** Catalogo publico: solo clientes activos. */
  listPublic(): Observable<readonly ClientSpace[]> {
    return this.#api.get<readonly ClientSpace[]>('public/clients');
  }

  /** Espacio del operador que tiene la sesion. */
  mine(): Observable<ClientSpace> {
    return this.#api.get<ClientSpace>('clients/me');
  }

  updateMine(patch: ClientPatch): Observable<ClientSpace> {
    return this.#api.patch<ClientSpace>('clients/me', patch);
  }

  /** Solo administrador. */
  list(): Observable<readonly ClientSpace[]> {
    return this.#api.get<readonly ClientSpace[]>('clients');
  }

  features(clientId?: string): Observable<readonly ClientFeatureFlag[]> {
    const path = clientId ? `clients/${encodeURIComponent(clientId)}/features` : 'clients/me/features';
    return this.#api.get<readonly ClientFeatureFlag[]>(path);
  }

  saveFeatures(
    features: readonly ClientFeatureFlag[],
    clientId?: string,
  ): Observable<readonly ClientFeatureFlag[]> {
    const path = clientId ? `clients/${encodeURIComponent(clientId)}/features` : 'clients/me/features';
    return this.#api.put<readonly ClientFeatureFlag[]>(path, { features });
  }
}

export interface ClientFeatureFlag {
  readonly feature:
    | 'delivery'
    | 'multi_venue'
    | 'desk_export'
    | 'desk_columns'
    | 'companion_turns';
  readonly enabled: boolean;
}
