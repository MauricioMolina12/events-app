import { describe, expect, it } from 'vitest';
import { brandInitials, contrastText, normalizeHex, shadeHex } from './brand-color';

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
