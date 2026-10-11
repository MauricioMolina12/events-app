import { Directive, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { FormField } from './form-field';

/**
 * Wires the accessibility and state feedback of a projected control to its `app-form-field`.
 *
 * Without it every field repeats the same three bindings (`aria-invalid`,
 * `aria-describedby`, `required`) and one of them always ends up forgotten. The state is
 * read live from the `NgControl`, so it stays correct no matter who writes the value
 * (`patchValue`, a server error, autofill…).
 *
 * ```html
 * <app-form-field controlId="regEmail" labelKey="register.email" required>
 *   <input id="regEmail" appField class="field" type="email" formControlName="email" />
 * </app-form-field>
 * ```
 *
 * Deliberately methods instead of `computed()`: host bindings are re-evaluated on every
 * change detection pass of the view, and a signal would go stale for the cases the form
 * directives mark dirty without touching an input-level signal.
 */
@Directive({
  selector: 'input[appField], select[appField], textarea[appField]',
  host: {
    '[attr.aria-invalid]': 'invalid() ? "true" : null',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.required]': 'required() ? "" : null',
    '[class.field--valid]': 'state() === "valid"',
  },
})
export class FieldControlDirective {
  readonly #field = inject(FormField, { host: true, optional: true });
  readonly #ngControl = inject(NgControl, { optional: true });

  protected invalid(): boolean {
    return this.state() === 'invalid';
  }

  /** `valid` (filled and accepted), `invalid` (already touched) or `null` (nothing to say). */
  protected state(): 'valid' | 'invalid' | null {
    const control = this.#ngControl?.control;
    if (!control) {
      return null;
    }
    const dirty = control.dirty || control.touched;
    if (control.invalid && dirty) {
      return 'invalid';
    }
    const value = control.value as unknown;
    const filled = value !== null && value !== undefined && String(value).trim() !== '';
    return control.valid && filled && dirty ? 'valid' : null;
  }

  protected describedBy(): string | null {
    return this.#field?.describedById() ?? null;
  }

  protected required(): boolean {
    return this.#field?.required() ?? false;
  }
}
