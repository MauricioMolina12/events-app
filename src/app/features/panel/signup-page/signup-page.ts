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
import { SessionStore } from '@core/auth';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { WorkspaceService } from '@core/workspace/workspace.service';
import { ButtonDirective, ThemeToggle } from '@shared/ui';

function matchingPasswords(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value as string | undefined;
  const confirmation = control.get('confirmPassword')?.value as string | undefined;
  return confirmation && password !== confirmation ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-panel-signup-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ButtonDirective, ThemeToggle],
  templateUrl: './signup-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelSignupPage {
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #errors = inject(ApiErrorPresenter);
  protected readonly workspace = inject(WorkspaceService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
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
      const returnUrl = this.#route.snapshot.queryParamMap.get('returnUrl');
      const destination =
        returnUrl === '/panel' || returnUrl?.startsWith('/panel/') ? returnUrl : '/panel';
      await this.#router.navigateByUrl(destination);
    } catch (error: unknown) {
      this.errorMessage.set(this.#errors.message(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
