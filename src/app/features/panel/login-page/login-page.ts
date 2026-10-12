import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthIntent, SessionStore, stripLegacyReturnUrl } from '@core/auth';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { BrandMark, ButtonDirective, Icon } from '@shared/ui';

@Component({
  selector: 'app-panel-login-page',
  imports: [ReactiveFormsModule, TranslatePipe, BrandMark, ButtonDirective, Icon],
  templateUrl: './login-page.html',
  styleUrl: '../auth-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelLoginPage {
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
  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.#session.login(this.form.getRawValue());
      await this.#continue();
    } catch (error: unknown) {
      this.errorMessage.set(this.#errors.message(error));
    } finally {
      this.submitting.set(false);
    }
  }

  async #continue(): Promise<void> {
    const destination = this.#intent.peek();
    const landed = await this.#router.navigateByUrl(destination, { replaceUrl: true });
    if (!landed && destination !== '/panel') {
      await this.#router.navigateByUrl('/panel', { replaceUrl: true });
    }
    this.#intent.clear();
  }
}