import type { Event as ManagedEvent } from '@core/domain';

const DAY_MS = 86_400_000;

/**
 * Evento que la pantalla de cupos abre sola.
 *
 * En curso gana sobre el próximo. Si hay varios en curso, gana el que termina
 * antes. No se elige el creado más reciente ni un borrador cuando no hay uno
 * operativo.
 */
export function pickRelevantEvent(
  events: readonly ManagedEvent[],
  now: Date = new Date(),
): ManagedEvent | null {
  if (events.length === 0) {
    return null;
  }
  const at = now.getTime();
  const running = events.filter((event) => isRunning(event, at));
  if (running.length > 0) {
    return [...running].sort((left, right) => endMs(left) - endMs(right))[0] ?? null;
  }
  const upcoming = events.filter((event) => isUpcoming(event, at));
  if (upcoming.length > 0) {
    return [...upcoming].sort((left, right) => startMs(left) - startMs(right))[0] ?? null;
  }
  const open = events.filter((event) => event.status !== 'draft' && event.status !== 'archived');
  return open.length === 1 ? open[0]! : null;
}

function isRunning(event: ManagedEvent, at: number): boolean {
  if (event.status === 'draft' || event.status === 'archived' || !event.startsAt) {
    return false;
  }
  const start = Date.parse(event.startsAt);
  return start <= at && at <= endMs(event);
}

function isUpcoming(event: ManagedEvent, at: number): boolean {
  if (event.status === 'draft' || event.status === 'archived' || !event.startsAt) {
    return false;
  }
  return Date.parse(event.startsAt) > at && endMs(event) >= at;
}

function startMs(event: ManagedEvent): number {
  return event.startsAt ? Date.parse(event.startsAt) : Number.MAX_SAFE_INTEGER;
}

function endMs(event: ManagedEvent): number {
  if (event.endsAt) {
    return Date.parse(event.endsAt);
  }
  if (event.startsAt) {
    return Date.parse(event.startsAt) + DAY_MS;
  }
  return Number.MAX_SAFE_INTEGER;
}
