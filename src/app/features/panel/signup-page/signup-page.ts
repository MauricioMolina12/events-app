import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthIntent, SessionStore, stripLegacyReturnUrl } from '@core/auth';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { BrandMark, ButtonDirective, Icon, ThemeToggle } from '@shared/ui';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('confirmPassword')?.value as string | undefined;
  return confirmation && password !== confirmation ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-panel-signup-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, BrandMark, ButtonDirective, Icon, ThemeToggle],
  templateUrl: './signup-page.html',
  styleUrl: '../auth-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelSignupPage {
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #intent = inject(AuthIntent);
  readonly #errors = inject(ApiErrorPresenter);

  constructor() {
    stripLegacyReturnUrl(this.#router, this.#route);
  }

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly form = new FormGroup(
    {
      fullName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(160)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(320)],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(12), Validators.maxLength(200)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [matchingPasswords] },
  );

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const { email, fullName, password } = this.form.getRawValue();
      await this.#session.signup({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
      });
      const destination = this.#intent.peek();
      const landed = await this.#router.navigateByUrl(destination, { replaceUrl: true });
      if (!landed && destination !== '/panel') {
        await this.#router.navigateByUrl('/panel', { replaceUrl: true });
      }
      this.#intent.clear();
    } catch (error: unknown) {
      this.errorMessage.set(this.#errors.message(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
