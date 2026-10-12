import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';

export type PanelModule =
  | 'dashboard'
  | 'mesa'
  | 'ingreso'
  | 'eventos'
  | 'sedes'
  | 'cupos'
  | 'configuracion'
  | 'colaboradores';

export interface CollaboratorMember {
  readonly id: string;
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly status: 'active' | 'disabled';
}

export interface CollaboratorGroup {
  readonly id: string;
  readonly name: string;
  readonly modules: readonly PanelModule[];
  readonly members: readonly CollaboratorMember[];
}

@Injectable({ providedIn: 'root' })
export class CollaboratorsApi {
  readonly #api = inject(ApiClient);

  list(): Observable<readonly CollaboratorGroup[]> {
    return this.#api.get<readonly CollaboratorGroup[]>('collaborators');
  }

  createGroup(name: string, modules: readonly PanelModule[]): Observable<CollaboratorGroup> {
    return this.#api.post<CollaboratorGroup>('collaborators/groups', { name, modules });
  }

  updateGroup(
    id: string,
    patch: { name?: string; modules?: readonly PanelModule[] },
  ): Observable<CollaboratorGroup> {
    return this.#api.patch<CollaboratorGroup>(`collaborators/groups/${encodeURIComponent(id)}`, patch);
  }

  addMember(
    groupId: string,
    body: { email: string; fullName: string; password: string },
  ): Observable<CollaboratorMember> {
    return this.#api.post<CollaboratorMember>(
      `collaborators/groups/${encodeURIComponent(groupId)}/members`,
      body,
    );
  }
}
