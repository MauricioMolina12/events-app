import { describe, expect, it } from 'vitest';
import {
  describeWindow,
  isWithinWindow,
  localInputToUtcIso,
  toZonedDateTimeDisplay,
  toZonedDisplay,
  utcIsoToLocalInput,
} from './dates';

/** Bogotá is UTC-5 all year round, which makes the expectations unambiguous. */
const BOGOTA = 'America/Bogota';

describe('toZonedDisplay', () => {
  it('returns an empty string for missing or invalid input', () => {
    expect(toZonedDisplay(null, BOGOTA)).toBe('');
    expect(toZonedDisplay(undefined, BOGOTA)).toBe('');
    expect(toZonedDisplay('no-es-una-fecha', BOGOTA)).toBe('');
  });

  it('renders the instant in the resource timezone, not the viewer one', () => {
    // 03:00 UTC on 25 April is still 24 April in Bogotá, so the calendar day must differ.
    const iso = '2026-04-25T03:00:00.000Z';

    expect(toZonedDisplay(iso, BOGOTA)).toContain('24');
    expect(toZonedDisplay(iso, 'UTC')).toContain('25');
    // The same instant, two timezones, two different renderings.
    expect(toZonedDateTimeDisplay(iso, BOGOTA)).not.toBe(toZonedDateTimeDisplay(iso, 'UTC'));
  });

  it('honours extra Intl options from the caller', () => {
    const iso = '2026-04-25T15:00:00.000Z';

    expect(toZonedDisplay(iso, BOGOTA, { dateStyle: 'full' })).toContain('sábado');
  });
});

describe('localInputToUtcIso', () => {
  it('reads a `datetime-local` wall clock as the resource timezone', () => {
    expect(localInputToUtcIso('2026-04-25T10:00', BOGOTA)).toBe('2026-04-25T15:00:00.000Z');
  });

  it('returns an empty string when the value is not a `datetime-local`', () => {
    expect(localInputToUtcIso('', BOGOTA)).toBe('');
    expect(localInputToUtcIso('25/04/2026 10:00', BOGOTA)).toBe('');
  });

  it('round-trips with `utcIsoToLocalInput`', () => {
    const local = '2026-04-25T10:00';

    expect(utcIsoToLocalInput(localInputToUtcIso(local, BOGOTA), BOGOTA)).toBe(local);
  });
});

describe('utcIsoToLocalInput', () => {
  it('converts an ISO instant into the resource wall clock', () => {
    expect(utcIsoToLocalInput('2026-04-25T15:00:00.000Z', BOGOTA)).toBe('2026-04-25T10:00');
  });

  it('returns an empty string for missing or invalid input', () => {
    expect(utcIsoToLocalInput(null, BOGOTA)).toBe('');
    expect(utcIsoToLocalInput('nope', BOGOTA)).toBe('');
  });
});

describe('isWithinWindow', () => {
  const opensAt = '2026-04-01T00:00:00.000Z';
  const closesAt = '2026-04-30T00:00:00.000Z';

  it('is inclusive on both ends', () => {
    expect(isWithinWindow(opensAt, closesAt, new Date(opensAt))).toBe(true);
    expect(isWithinWindow(opensAt, closesAt, new Date(closesAt))).toBe(true);
  });

  it('is false before the opening and after the closing', () => {
    expect(isWithinWindow(opensAt, closesAt, new Date('2026-03-31T23:59:59.000Z'))).toBe(false);
    expect(isWithinWindow(opensAt, closesAt, new Date('2026-04-30T00:00:01.000Z'))).toBe(false);
  });

  it('treats `null` as an open end', () => {
    expect(isWithinWindow(null, null, new Date('1999-01-01T00:00:00.000Z'))).toBe(true);
    expect(isWithinWindow(null, closesAt, new Date('2027-01-01T00:00:00.000Z'))).toBe(false);
    expect(isWithinWindow(opensAt, null, new Date('2027-01-01T00:00:00.000Z'))).toBe(true);
  });
});

describe('describeWindow', () => {
  it('describes a closed window', () => {
    const text = describeWindow('2026-04-01T00:00:00.000Z', '2026-04-30T00:00:00.000Z', BOGOTA);

    expect(text.startsWith('Del ')).toBe(true);
    expect(text).toContain(' al ');
  });

  it('describes one-sided windows and the undefined case', () => {
    expect(describeWindow('2026-04-01T00:00:00.000Z', null, BOGOTA).startsWith('Desde el ')).toBe(
      true,
    );
    expect(describeWindow(null, '2026-04-30T00:00:00.000Z', BOGOTA).startsWith('Hasta el ')).toBe(
      true,
    );
    expect(describeWindow(null, null, BOGOTA)).toBe('Sin ventana definida');
  });
});
