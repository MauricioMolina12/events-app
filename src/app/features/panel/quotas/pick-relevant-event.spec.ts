import { describe, expect, it } from 'vitest';
import type { Event as ManagedEvent } from '@core/domain';
import { pickRelevantEvent } from './pick-relevant-event';

const NOW = new Date('2026-10-11T15:00:00.000Z');

function event(overrides: Partial<ManagedEvent> & Pick<ManagedEvent, 'id' | 'name'>): ManagedEvent {
  return {
    slug: overrides.id,
    description: null,
    timezone: 'America/Bogota',
    startsAt: null,
    endsAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    capacity: 100,
    status: 'published',
    createdBy: null,
    client: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickRelevantEvent', () => {
  it('keeps the only event', () => {
    const only = event({ id: 'one', name: 'Único' });
    expect(pickRelevantEvent([only], NOW)?.id).toBe('one');
  });

  it('prefers the in-progress event that ends sooner over a newer one', () => {
    const later = event({
      id: 'later',
      name: 'Termina tarde',
      startsAt: '2026-10-11T12:00:00.000Z',
      endsAt: '2026-10-11T22:00:00.000Z',
      createdAt: '2026-10-10T00:00:00.000Z',
    });
    const sooner = event({
      id: 'sooner',
      name: 'Termina pronto',
      startsAt: '2026-10-11T12:00:00.000Z',
      endsAt: '2026-10-11T16:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(pickRelevantEvent([later, sooner], NOW)?.id).toBe('sooner');
  });

  it('picks the nearest upcoming event when nothing is in progress', () => {
    const far = event({
      id: 'far',
      name: 'Lejano',
      startsAt: '2026-12-01T15:00:00.000Z',
    });
    const next = event({
      id: 'next',
      name: 'Próximo',
      startsAt: '2026-10-20T15:00:00.000Z',
    });
    expect(pickRelevantEvent([far, next], NOW)?.id).toBe('next');
  });

  it('does not guess among drafts', () => {
    const draft = event({
      id: 'draft',
      name: 'Borrador',
      status: 'draft',
      startsAt: '2026-10-11T12:00:00.000Z',
      createdAt: '2026-10-11T00:00:00.000Z',
    });
    expect(pickRelevantEvent([draft], NOW)).toBeNull();
  });
});
