import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Page } from '@core/api';
import { ApiClient } from '@core/api';
import type { UserRole, UserStatus } from '@core/auth/models';
import type { AdminUser } from '@core/domain';

export interface UserListQuery {
  readonly search?: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CreateUserRequest {
  readonly email: string;
  readonly fullName: string;
  readonly password: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
}

export interface UpdateUserRequest {
  readonly email?: string;
  readonly fullName?: string;
  readonly role?: UserRole;
  readonly status?: UserStatus;
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  readonly #api = inject(ApiClient);

  list(query: UserListQuery = {}): Observable<Page<AdminUser>> {
    return this.#api.getPage<AdminUser>('users', {
      search: query.search,
      role: query.role,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  create(request: CreateUserRequest): Observable<AdminUser> {
    return this.#api.post<AdminUser>('users', request);
  }

  update(id: string, request: UpdateUserRequest): Observable<AdminUser> {
    return this.#api.patch<AdminUser>(`users/${encodeURIComponent(id)}`, request);
  }

  resetPassword(id: string, password: string): Observable<{ revokedSessions: number }> {
    return this.#api.post<{ revokedSessions: number }>(
      `users/${encodeURIComponent(id)}/password`,
      { password },
    );
  }
}
