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

const INK = '#0F172A';
const PAPER = '#FFFFFF';
/** WCAG AA for normal text. Filled brand surfaces have to clear this. */
const MIN_CONTRAST = 4.5;

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastText(hex: string): '#FFFFFF' | '#0F172A' {
  const background = normalizeHex(hex) ?? DEFAULT_PRIMARY;
  return contrastRatio(PAPER, background) >= contrastRatio(INK, background) ? PAPER : INK;
}

/**
 * A brand color the user picked, safe to paint as a fill.
 *
 * The text (and anything that inherits it: icons, badges) is the ink that
 * contrasts more. If neither ink reaches 4.5:1, the fill shifts toward black
 * or white — whichever needs the smaller change — until it does.
 */
export function readableFill(hex: string): { background: string; on: '#FFFFFF' | '#0F172A' } {
  const start = normalizeHex(hex) ?? DEFAULT_PRIMARY;
  const asIs = pair(start);
  if (asIs.ratio >= MIN_CONTRAST) {
    return { background: start, on: asIs.on };
  }
  const darkened = walk(start, '#000000', PAPER);
  const lightened = walk(start, PAPER, INK);
  return darkened.steps <= lightened.steps
    ? { background: darkened.background, on: PAPER }
    : { background: lightened.background, on: INK };
}

/** Brand color used as text or an icon on a light surface. */
export function accentOnSurface(hex: string): string {
  const start = normalizeHex(hex) ?? DEFAULT_PRIMARY;
  if (contrastRatio(start, PAPER) >= MIN_CONTRAST) {
    return start;
  }
  return walk(start, '#000000', PAPER).background;
}

/** Hover fill that keeps the same text color above 4.5:1. */
export function readableHover(background: string, on: '#FFFFFF' | '#0F172A'): string {
  const candidate = on === PAPER ? shadeHex(background, 0.86) : mixHex(background, '#000000', 0.08);
  return contrastRatio(on, candidate) >= MIN_CONTRAST ? candidate : background;
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

function pair(background: string): { on: '#FFFFFF' | '#0F172A'; ratio: number } {
  const onWhite = contrastRatio(PAPER, background);
  const onInk = contrastRatio(INK, background);
  return onWhite >= onInk ? { on: PAPER, ratio: onWhite } : { on: INK, ratio: onInk };
}

function walk(
  start: string,
  toward: string,
  ink: '#FFFFFF' | '#0F172A',
): { background: string; steps: number } {
  let background = start;
  for (let step = 1; step <= 32; step += 1) {
    background = mixHex(start, toward, step / 32);
    if (contrastRatio(ink, background) >= MIN_CONTRAST) {
      return { background, steps: step };
    }
  }
  return { background, steps: 32 };
}

function mixHex(from: string, to: string, amount: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  const mix = (left: number, right: number) => Math.round(left + (right - left) * amount);
  return toHex(mix(start.r, end.r), mix(start.g, end.g), mix(start.b, end.b));
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
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
