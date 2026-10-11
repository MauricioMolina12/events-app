import { describe, expect, it } from 'vitest';
import { EVENT_STATUS_TRANSITIONS } from './event-status';

describe('event status transitions', () => {
  it('matches the lifecycle accepted by the API', () => {
    expect(EVENT_STATUS_TRANSITIONS).toEqual({
      draft: ['published', 'archived'],
      published: ['closed', 'archived'],
      closed: ['published', 'archived'],
      archived: [],
    });
  });
});
