/** URL-safe slug used by event slugs and establishment codes. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/** Suggests a slug from a free-text name (`Día del Niño 2026` → `dia-del-nino-2026`). */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Short operational code for a sede (`Colegio Norte` → `colegio-norte`). */
export function venueCode(value: string): string {
  return slugify(value).slice(0, 32);
}

/** Suggests a slug for an event date (`2026-04-25`). */
export function dateSlug(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Short, non-cryptographic id for optimistic UI keys. */
export function shortId(prefix = 'id'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
