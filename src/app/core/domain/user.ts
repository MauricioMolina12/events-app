import type { UserRole, UserStatus } from '@core/auth/models';

/**
 * Platform user as the panel sees it, mirrored from `events-api` (`GET /users`).
 *
 * Roles are not redefined here: `@core/auth/models` already owns the pair the session
 * carries, and two sources of truth for a permission string is how a guard and an
 * endpoint drift apart. `AuthUser` is the trimmed `GET /auth/me`; this is the row the
 * user-management screen edits.
 */

export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly failedLoginAttempts: number;
  /** Set while the account is locked after repeated failures. */
  readonly lockedUntil: string | null;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
