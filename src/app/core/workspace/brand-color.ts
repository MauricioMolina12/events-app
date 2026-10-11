/** Hex de 6 dígitos. Cualquier otro valor CSS se rechaza. */
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const DEFAULT_PRIMARY = '#C81F68';

export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!HEX.test(trimmed)) {
    return null;
  }
  return trimmed.toUpperCase();
}

export function contrastText(hex: string): '#FFFFFF' | '#0F172A' {
  const { r, g, b } = parseHex(hex);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const onWhite = 1.05 / (luminance + 0.05);
  const onBlack = (luminance + 0.05) / 0.05;
  return onWhite >= onBlack ? '#FFFFFF' : '#0F172A';
}

/** Oscurece un hex. `factor` 1 deja el color igual; 0.86 es el hover. */
export function shadeHex(hex: string, factor: number): string {
  const { r, g, b } = parseHex(hex);
  const mix = (value: number) => Math.max(0, Math.min(255, Math.round(value * factor)));
  return toHex(mix(r), mix(g), mix(b));
}

export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const first = words[0];
  if (!first) {
    return 'E';
  }
  const second = words[1];
  if (second) {
    return `${first.charAt(0)}${second.charAt(0)}`.toLocaleUpperCase('es-CO');
  }
  const compact = first.replace(/[^\p{L}\p{N}]+/gu, '');
  return (compact.slice(0, 2) || 'E').toLocaleUpperCase('es-CO');
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? DEFAULT_PRIMARY;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function channel(value: number): number {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
