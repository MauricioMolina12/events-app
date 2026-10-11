import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey, MessageParams } from '@core/i18n';
import { ButtonDirective } from '../button.directive';

export interface ConfirmNoteSpec {
  readonly labelKey: MessageKey;
  readonly hintKey?: MessageKey;
  readonly placeholderKey?: MessageKey;
  readonly minLength: number;
  readonly maxLength: number;
}

export interface ConfirmData {
  readonly titleKey: MessageKey;
  readonly bodyKey?: MessageKey;
  readonly bodyParams?: MessageParams;
  readonly confirmKey?: MessageKey;
  readonly tone?: 'primary' | 'danger';
  /** When present the dialog also collects a free-text note and blocks "confirm" until valid. */
  readonly note?: ConfirmNoteSpec;
}

export interface ConfirmResult {
  readonly confirmed: boolean;
  readonly note: string;
}

/**
 * Generic confirmation dialog. It returns a result and nothing else — the caller owns
 * the side effect, so the same dialog serves "cancel registration", "archive event"
 * and "deactivate user" without growing conditionals.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, ButtonDirective],
  templateUrl: './confirm-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly #ref = inject<DialogRef<ConfirmResult>>(DialogRef);
  protected readonly data = inject<ConfirmData>(DIALOG_DATA);
  protected readonly note = signal('');

  protected readonly canConfirm = computed(() => {
    const spec = this.data.note;
    if (!spec) {
      return true;
    }
    const length = this.note().trim().length;
    return length >= spec.minLength && length <= spec.maxLength;
  });

  protected readonly confirmVariant = computed(() =>
    this.data.tone === 'danger' ? 'danger' : 'primary',
  );

  protected onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.#ref.close({ confirmed: true, note: this.note().trim() });
  }

  protected cancel(): void {
    this.#ref.close({ confirmed: false, note: '' });
  }
}
