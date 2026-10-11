import { Injectable, computed, signal } from '@angular/core';
import { environment } from '@env/environment';
import { MESSAGES, interpolate, type MessageKey, type MessageParams } from './messages';

export type SupportedLocale = 'es-CO';

const CATALOGS: Record<SupportedLocale, typeof MESSAGES> = {
  'es-CO': MESSAGES,
};

/**
 * Tiny i18n layer. One locale today (`es-CO`), but every string already goes
 * through a key so adding a locale is a data change, not a refactor.
 *
 * `t()` reads the locale signal, so calling it from a template registers a reactive
 * dependency and the view re-renders when the locale changes (zoneless-safe).
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly #locale = signal<SupportedLocale>(environment.defaultLocale as SupportedLocale);
  readonly locale = this.#locale.asReadonly();
  readonly catalog = computed(() => CATALOGS[this.#locale()]);

  t(key: MessageKey, params?: MessageParams): string {
    return interpolate(this.catalog()[key], params);
  }

  setLocale(locale: SupportedLocale): void {
    this.#locale.set(locale);
  }
}
