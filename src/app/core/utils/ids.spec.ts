import { describe, expect, it } from 'vitest';
import { isValidSlug, slugify, venueCode } from './ids';

describe('slugify', () => {
  it('derives a URL slug from a display name in real time', () => {
    expect(slugify('Día del Niño 2026')).toBe('dia-del-nino-2026');
    expect(slugify('  Feria --- Primavera  ')).toBe('feria-primavera');
  });

  it('strips punctuation and caps length at 80 characters', () => {
    expect(slugify('A & B / C')).toBe('a-b-c');
    expect(slugify('a'.repeat(90)).length).toBe(80);
  });
});

describe('venueCode', () => {
  it('derives a short operational code from a venue name', () => {
    expect(venueCode('Colegio Norte')).toBe('colegio-norte');
    expect(venueCode('a'.repeat(40)).length).toBe(32);
  });
});

describe('isValidSlug', () => {
  it('accepts hyphenated lowercase tokens', () => {
    expect(isValidSlug('dia-del-nino-2026')).toBe(true);
    expect(isValidSlug('AB')).toBe(false);
    expect(isValidSlug('too--many')).toBe(false);
  });
});
