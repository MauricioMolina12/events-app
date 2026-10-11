import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionStore } from '@core/auth';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { WorkspaceService } from '@core/workspace/workspace.service';
import { ButtonDirective, ThemeToggle } from '@shared/ui';

@Component({
  selector: 'app-panel-login-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ButtonDirective, ThemeToggle],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelLoginPage {
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #errors = inject(ApiErrorPresenter);
  protected readonly workspace = inject(WorkspaceService);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
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
      const returnUrl = this.#route.snapshot.queryParamMap.get('returnUrl');
      const destination = returnUrl === '/panel' || returnUrl?.startsWith('/panel/')
        ? returnUrl
        : '/panel';
      await this.#router.navigateByUrl(destination);
    } catch (error: unknown) {
      this.errorMessage.set(this.#errors.message(error));
    } finally {
      this.submitting.set(false);
    }
  }
}