import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n';

/**
 * Label + control + hint + error scaffold.
 *
 * The control itself is projected, so this stays agnostic of `ngModel` vs. reactive
 * forms and keeps Angular's validation config on the real `<input>`.
 *
 * Hint and error are mutually exclusive — showing both at once is noise — and each one
 * carries a deterministic id so `appField` can point `aria-describedby` at whichever is
 * on screen.
 */
@Component({
  selector: 'app-form-field',
  imports: [TranslatePipe],
  templateUrl: './form-field.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField {
  /** Must match the projected control's `id` so the `<label for>` association works. */
  readonly controlId = input.required<string>();
  readonly labelKey = input.required<MessageKey>();
  readonly hintKey = input<MessageKey | undefined>(undefined);
  /** Already-localised hint, for text that depends on data (capacity, limits). */
  readonly hintText = input<string | undefined>(undefined);
  /** Already-localised error text; the form decides which message to show. */
  readonly error = input<string | undefined>(undefined);
  readonly required = input(false, { transform: booleanAttribute });
  readonly optional = input(false, { transform: booleanAttribute });

  readonly hintId = computed(() => `${this.controlId()}-hint`);
  readonly errorId = computed(() => `${this.controlId()}-error`);

  /** Id of the visible description, or `null` when the field has neither hint nor error. */
  readonly describedById = computed(() => {
    if (this.error()) {
      return this.errorId();
    }
    return this.hintKey() || this.hintText() ? this.hintId() : null;
  });
}
