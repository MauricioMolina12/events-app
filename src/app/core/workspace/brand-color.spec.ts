import { describe, expect, it } from 'vitest';
import { brandInitials, contrastRatio, contrastText, normalizeHex, readableFill, shadeHex } from './brand-color';

describe('normalizeHex', () => {
  it('acepta un hexadecimal de 6 digitos y lo normaliza', () => {
    expect(normalizeHex('#c81f68')).toBe('#C81F68');
    expect(normalizeHex('  #112233 ')).toBe('#112233');
  });

  it('rechaza nombres, rgb y hex cortos', () => {
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('rgb(0,0,0)')).toBeNull();
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('#C81F68;')).toBeNull();
  });
});

describe('contrastText', () => {
  it('elige el texto con mejor contraste', () => {
    expect(contrastText('#000000')).toBe('#FFFFFF');
    expect(contrastText('#FFFFFF')).toBe('#0F172A');
  });
});

describe('readableFill', () => {
  it('keeps a dark brand and paints white text on it', () => {
    const fill = readableFill('#0F172A');
    expect(fill.background).toBe('#0F172A');
    expect(fill.on).toBe('#FFFFFF');
    expect(contrastRatio(fill.on, fill.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps a light brand and paints dark text on it', () => {
    const fill = readableFill('#F8FAFC');
    expect(fill.on).toBe('#0F172A');
    expect(contrastRatio(fill.on, fill.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('shifts a fill that misses 4.5 against both inks', () => {
    const raw = ['#777777', '#808080', '#868686', '#8A8A8A'].find(
      (hex) => contrastRatio('#FFFFFF', hex) < 4.5 && contrastRatio('#0F172A', hex) < 4.5,
    );
    expect(raw).toBeTruthy();
    const fill = readableFill(raw ?? '#808080');
    expect(contrastRatio(fill.on, fill.background)).toBeGreaterThanOrEqual(4.5);
    expect(fill.background).not.toBe(raw);
  });
});

describe('shadeHex', () => {
  it('oscurece sin salir del rango', () => {
    expect(shadeHex('#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('brandInitials', () => {
  it('usa las dos primeras palabras o las dos primeras letras', () => {
    expect(brandInitials('Mauricio Molina')).toBe('MM');
    expect(brandInitials('Soporte')).toBe('SO');
    expect(brandInitials('')).toBe('E');
  });
});
