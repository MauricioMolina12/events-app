import { describe, expect, it } from 'vitest';
import { seatCount, venueQuotaOverflow } from './participation-capacity';

describe('seatCount', () => {
  it('accepts a whole number in range', () => {
    expect(seatCount(0)).toBe(0);
    expect(seatCount('12')).toBe(12);
    expect(seatCount(' 40 ')).toBe(40);
  });

  it('rejects blanks, fractions and values outside the range', () => {
    expect(seatCount('')).toBeNull();
    expect(seatCount('1.5')).toBeNull();
    expect(seatCount(-1)).toBeNull();
    expect(seatCount(100_001)).toBeNull();
  });
});

describe('venueQuotaOverflow', () => {
  it('accepts when both pools fit in the seats the event still has', () => {
    expect(
      venueQuotaOverflow({
        eventCapacity: 100,
        alreadyAllocated: 40,
        titularCapacity: 30,
        companionCapacity: 30,
      }),
    ).toBeNull();
  });

  it('rejects when titulares alone pass the remainder', () => {
    expect(
      venueQuotaOverflow({
        eventCapacity: 100,
        alreadyAllocated: 90,
        titularCapacity: 15,
        companionCapacity: 0,
      }),
    ).toMatchObject({ remaining: 10, requested: 15 });
  });

  it('rejects when acompañantes alone pass the remainder', () => {
    expect(
      venueQuotaOverflow({
        eventCapacity: 50,
        alreadyAllocated: 40,
        titularCapacity: 0,
        companionCapacity: 20,
      }),
    ).toMatchObject({ remaining: 10, requested: 20 });
  });

  it('rejects when each pool fits but together they pass the remainder', () => {
    expect(
      venueQuotaOverflow({
        eventCapacity: 20,
        alreadyAllocated: 10,
        titularCapacity: 6,
        companionCapacity: 6,
      }),
    ).toMatchObject({ remaining: 10, requested: 12 });
  });
});
