import { describe, expect, it } from 'vitest';
import type { Participation } from '@core/domain';
import {
  occupancyLevel,
  occupancyPercent,
  summarizeVenues,
  venueSnapshot,
} from './venue-occupancy';

function participation(overrides: Partial<Participation> = {}): Participation {
  return {
    id: 'p1',
    eventId: 'e1',
    establishmentId: 's1',
    status: 'open',
    titularCapacity: 200,
    companionCapacity: 100,
    confirmedTitulares: 140,
    confirmedCompanions: 75,
    availableTitulares: 60,
    availableCompanions: 25,
    registrationOpensAt: null,
    registrationClosesAt: null,
    checkInOpensAt: null,
    checkInClosesAt: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    establishment: {
      id: 's1',
      code: 'barby',
      name: 'Barby Toys',
      city: 'Bogotá',
      status: 'active',
    },
    ...overrides,
  };
}

describe('venue occupancy', () => {
  it('uses the API availability and keeps a sede with seats out of the full state', () => {
    const venue = venueSnapshot(participation());

    expect(venue.capacity).toBe(300);
    expect(venue.occupied).toBe(215);
    expect(venue.available).toBe(85);
    expect(venue.percent).toBe(71.7);
    expect(venue.level).toBe('high');
    expect(occupancyLevel(300, 1, 299)).toBe('critical');
    expect(occupancyPercent(299, 300, 1)).toBe(99.7);
  });

  it('marks a sede full only when the API reports no seats left', () => {
    const venue = venueSnapshot(
      participation({
        confirmedTitulares: 200,
        confirmedCompanions: 100,
        availableTitulares: 0,
        availableCompanions: 0,
      }),
    );

    expect(venue.level).toBe('full');
    expect(venue.percent).toBe(100);
  });

  it('does not call an unassigned or empty sede full', () => {
    expect(occupancyLevel(0, 0, 0)).toBe('unassigned');
    expect(occupancyLevel(300, 300, 0)).toBe('normal');
    expect(
      venueSnapshot(participation({ status: 'cancelled', availableTitulares: 0, availableCompanions: 0 }))
        .level,
    ).toBe('cancelled');
  });

  it('counts registrations as titulares and ignores cancelled sedes in the summary input', () => {
    const active = venueSnapshot(participation());
    const empty = venueSnapshot(
      participation({
        id: 'p2',
        confirmedTitulares: 0,
        confirmedCompanions: 0,
        availableTitulares: 10,
        availableCompanions: 0,
        titularCapacity: 10,
        companionCapacity: 0,
        establishment: {
          id: 's2',
          code: 'cupidos',
          name: 'Cupidos',
          city: null,
          status: 'active',
        },
      }),
    );
    const summary = summarizeVenues([active, empty]);

    expect(summary.registrations).toBe(140);
    expect(summary.occupied).toBe(215);
    expect(summary.available).toBe(95);
    expect(summary.busiest?.name).toBe('Barby Toys');
    expect(summary.fullCount).toBe(0);
  });
});
