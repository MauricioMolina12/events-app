import type { EventStatus } from '@core/domain';

export const EVENT_STATUSES: readonly EventStatus[] = ['draft', 'published', 'closed', 'archived'];

export const EVENT_STATUS_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  draft: ['published', 'archived'],
  published: ['closed', 'archived'],
  closed: ['published', 'archived'],
  archived: [],
};

export function isEventStatus(value: string): value is EventStatus {
  return EVENT_STATUSES.includes(value as EventStatus);
}
