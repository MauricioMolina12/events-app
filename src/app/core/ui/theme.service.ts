import { Injectable, effect, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark';

/**
 * Must match the inline script in `index.html`, which applies the stored value
 * before first paint. It is written raw (no JSON envelope) so that plain script can
 * read it without duplicating the storage utility.
 */
const STORAGE_KEY = 'events.theme';

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function persist(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* private mode / storage disabled — the choice simply will not survive a reload */
  }
}

/**
 * Owns `<html data-theme>`. The initial value is applied by an inline script in
 * `index.html`; this service takes over from there and keeps the choice persisted.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly #preference = signal<ThemePreference>(readPreference());
  readonly preference = this.#preference.asReadonly();

  constructor() {
    effect(() => {
      this.#apply(this.#preference());
    });
  }

  set(preference: ThemePreference): void {
    persist(preference);
    this.#preference.set(preference);
  }

  #apply(preference: ThemePreference): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.dataset['theme'] = preference;
  }
}
