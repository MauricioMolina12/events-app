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
}
