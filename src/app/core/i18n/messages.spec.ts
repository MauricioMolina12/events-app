import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGE_KEYS, errorMessageKey } from '../api/error-messages';
import type { StatusKind } from '../../shared/ui/status-badge';
import { MESSAGES, interpolate, type MessageKey } from './messages';

describe('interpolate', () => {
  it('returns the message untouched when there are no params', () => {
    expect(interpolate('Sin cambios')).toBe('Sin cambios');
  });

  it('replaces tokens with strings and numbers', () => {
    expect(interpolate('Quedan {count} cupos', { count: 3 })).toBe('Quedan 3 cupos');
    expect(interpolate('Página {page} de {pages}', { page: 1, pages: 4 })).toBe('Página 1 de 4');
  });

  it('leaves unknown tokens in place so the bug is visible', () => {
    expect(interpolate('Hola {nombre}', { otro: 'x' })).toBe('Hola {nombre}');
  });

  it('replaces every occurrence of a token', () => {
    expect(interpolate('{a}-{a}', { a: 'x' })).toBe('x-x');
  });
});

describe('message catalog', () => {
  it('maps every API error code to a defined message', () => {
    for (const [code, key] of Object.entries(ERROR_MESSAGE_KEYS)) {
      expect(MESSAGES[key], `code ${code}`).toBeTruthy();
    }
  });

  it('falls back to a generic message for unknown or absent codes', () => {
    expect(errorMessageKey(undefined)).toBe('errors.unknown');
    expect(errorMessageKey('ALGO_NUEVO_DEL_BACKEND')).toBe('errors.unknown');
    expect(errorMessageKey('FORBIDDEN')).toBe('errors.forbidden');
    expect(errorMessageKey('DUPLICATE_DOCUMENT')).toBe('errors.duplicateDocument');
  });

  it('defines the `status.<kind>` label every StatusBadge can render', () => {
    // `StatusBadge.labelKey` is built by concatenation, so TypeScript cannot verify it:
    // this list is what keeps a new status from rendering as a raw key.
    const kinds = [
      'event.draft',
      'event.published',
      'event.closed',
      'event.archived',
      'establishment.active',
      'establishment.inactive',
      'participation.open',
      'participation.closed',
      'participation.cancelled',
      'registration.confirmed',
      'registration.waitlisted',
      'registration.cancelled',
      'user.active',
      'user.disabled',
    ] as const satisfies readonly StatusKind[];

    for (const kind of kinds) {
      expect(MESSAGES[`status.${kind}` as MessageKey], kind).toBeTruthy();
    }
  });

  it('has no empty value and no key that looks like a sentence', () => {
    for (const [key, value] of Object.entries(MESSAGES)) {
      expect(value.trim(), key).not.toBe('');
      // A value equal to its own key would mean someone shipped a placeholder.
      expect(value, key).not.toBe(key);
    }
  });
});
