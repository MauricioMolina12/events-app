import { Injectable, signal } from '@angular/core';
import type { MessageKey, MessageParams } from '@core/i18n';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastMessage {
  readonly id: number;
  readonly tone: ToastTone;
  readonly messageKey: MessageKey;
  readonly params?: MessageParams;
  /** Correlation id taken from the API envelope, so the user can quote it to support. */
  readonly supportCode?: string;
}

export interface ToastOptions {
  readonly params?: MessageParams;
  readonly supportCode?: string;
  /** Milliseconds before auto-dismiss. `0` keeps the toast until the user closes it. */
  readonly duration?: number;
}

const DEFAULT_DURATION = 6000;
const MAX_VISIBLE = 4;

/**
 * Screen-reader output and transient feedback.
 *
 * The service stores **keys**, never rendered strings: the toast host resolves them
 * through `I18nService` at render time, so a locale change re-renders live toasts.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly #toasts = signal<readonly ToastMessage[]>([]);
  readonly toasts = this.#toasts.asReadonly();

  #sequence = 0;

  show(messageKey: MessageKey, tone: ToastTone = 'info', options: ToastOptions = {}): number {
    const id = ++this.#sequence;
    const toast: ToastMessage = {
      id,
      tone,
      messageKey,
      ...(options.params ? { params: options.params } : {}),
      ...(options.supportCode ? { supportCode: options.supportCode } : {}),
    };
    this.#toasts.update((current) => [...current, toast].slice(-MAX_VISIBLE));

    const duration = options.duration ?? DEFAULT_DURATION;
    if (duration > 0 && typeof setTimeout !== 'undefined') {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  success(messageKey: MessageKey, options?: ToastOptions): number {
    return this.show(messageKey, 'success', options);
  }

  info(messageKey: MessageKey, options?: ToastOptions): number {
    return this.show(messageKey, 'info', options);
  }

  warning(messageKey: MessageKey, options?: ToastOptions): number {
    return this.show(messageKey, 'warning', options);
  }

  /** Failures stay until dismissed: the user may need to copy the support code. */
  error(messageKey: MessageKey, options?: ToastOptions): number {
    return this.show(messageKey, 'danger', { duration: 0, ...options });
  }

  dismiss(id: number): void {
    this.#toasts.update((current) => current.filter((toast) => toast.id !== id));
  }

  clear(): void {
    this.#toasts.set([]);
  }
}
