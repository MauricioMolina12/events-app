import { describe, expect, it } from 'vitest';
import { readReturnTo, safeEventSlug, safeReturnPath } from './return-to';

describe('safeReturnPath', () => {
  it('accepts the desk and the catalogue pages the app itself navigates to', () => {
    expect(safeReturnPath('/panel/mesa')).toBe('/panel/mesa');
    expect(safeReturnPath('/eventos')).toBe('/eventos');
    expect(safeReturnPath('/eventos/gran-madrugon-2026')).toBe('/eventos/gran-madrugon-2026');
    expect(safeReturnPath('/clientes/barby/eventos')).toBe('/clientes/barby/eventos');
  });

  it('rejects the inscription screen, external urls and anything that is not a known path', () => {
    expect(safeReturnPath('/eventos/gran-madrugon-2026/inscripcion')).toBeNull();
    expect(safeReturnPath('/inscripcion')).toBeNull();
    expect(safeReturnPath('https://evil.test/panel/mesa')).toBeNull();
    expect(safeReturnPath('//evil.test/eventos')).toBeNull();
    expect(safeReturnPath('/eventos/foo/bar')).toBeNull();
    expect(safeReturnPath('/eventos/../secret')).toBeNull();
    expect(safeReturnPath('/eventos/foo?next=https://evil.test')).toBeNull();
    expect(safeReturnPath('javascript:alert(1)')).toBeNull();
    expect(safeReturnPath('/panel/login')).toBeNull();
  });

  it('accepts a catalog slug and rejects anything that is not one', () => {
    expect(safeEventSlug('gran-madrugon-2026')).toBe('gran-madrugon-2026');
    expect(safeEventSlug('  gran-madrugon-2026  ')).toBe('gran-madrugon-2026');
    expect(safeEventSlug('../panel')).toBeNull();
    expect(safeEventSlug('https://evil.test')).toBeNull();
    expect(safeEventSlug('gran madrugon')).toBeNull();
    expect(safeEventSlug('')).toBeNull();
  });

  it('reads returnTo from navigation state and ignores other shapes', () => {
    expect(readReturnTo({ returnTo: '/panel/mesa', sede: 's1' })).toBe('/panel/mesa');
    expect(readReturnTo({ returnTo: 'https://evil.test' })).toBeNull();
    expect(readReturnTo(null)).toBeNull();
    expect(readReturnTo(' /panel/mesa ')).toBeNull();
  });
});
