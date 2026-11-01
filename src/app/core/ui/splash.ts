import { Injectable, computed, signal } from '@angular/core';
import type { MessageKey } from '@core/i18n';

/**
 * Full-screen hold while the session is restoring, a sign-in is finishing,
 * or a sign-out is leaving the panel. Nested holds stay up until each one ends.
 */
@Injectable({ providedIn: 'root' })
export class Splash {
  readonly #depth = signal(0);
  readonly #message = signal<MessageKey>('splash.loading');

  readonly visible = computed(() => this.#depth() > 0);
  readonly message = this.#message.asReadonly();

  hold(message: MessageKey = 'splash.loading'): () => void {
    if (this.#depth() === 0) {
      this.#message.set(message);
    }
    this.#depth.update((depth) => depth + 1);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this.#depth.update((depth) => Math.max(0, depth - 1));
    };
  }
}
