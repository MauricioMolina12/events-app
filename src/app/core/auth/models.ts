export type UserRole = 'admin' | 'operator';
export type UserStatus = 'active' | 'disabled';

/** Authenticated principal, mirrored from `GET /auth/me`. */
export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
}

/** Server-issued session metadata. `expiresAt` is ISO-8601 UTC. */
export interface AuthSession {
  readonly id: string;
  readonly expiresAt: string;
}

export interface SessionPayload {
  readonly user: AuthUser;
  readonly session: AuthSession;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface SignupRequest {
  readonly email: string;
  readonly fullName: string;
  readonly password: string;
}

export interface LogoutResponse {
  readonly revoked: boolean;
}
