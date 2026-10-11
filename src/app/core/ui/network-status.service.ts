import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  readonly #online = signal(readInitialState());
  readonly online = this.#online.asReadonly();
  readonly offline = computed(() => !this.#online());

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('online', this.#onOnline);
    window.addEventListener('offline', this.#onOffline);
  }

  #onOnline = (): void => {
    this.#online.set(true);
  };

  #onOffline = (): void => {
    this.#online.set(false);
  };
}

function readInitialState(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
