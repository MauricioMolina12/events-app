import type { AuthUser } from '@core/auth';

/** True when the signed-in user may edit this event's ficha, sedes and cupos. */
export function canManageEvent(
  user: AuthUser | null,
  event: { createdBy: string | null },
): boolean {
  if (user === null) {
    return false;
  }
  return user.role === 'admin' || event.createdBy === user.id;
}
