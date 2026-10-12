import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, switchMap } from 'rxjs';
import type { Page } from '@core/api';
import type { AdminUser } from '@core/domain';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter, ConfirmService } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import {
  ButtonDirective,
  EmptyState,
  Icon,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@shared/ui';
import { UsersApi } from '../users.api';

@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonDirective,
    EmptyState,
    Icon,
    PageHeader,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  readonly #api = inject(UsersApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #confirm = inject(ConfirmService);
  readonly #i18n = inject(I18nService);
  readonly #attempt = signal(0);

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly term = signal('');
  protected readonly form = new FormGroup({
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
  });

  readonly state = toSignal(
    toObservable(this.#attempt).pipe(
      switchMap(() => this.#api.list({ limit: 100 }).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<Page<AdminUser>>() },
  );

  protected readonly users = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return [];
    }
    const query = this.term().trim().toLowerCase();
    return state.value.items.filter((user) => {
      if (!query) {
        return true;
      }
      return (
        user.fullName.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
      );
    });
  });

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });

  protected retry(): void {
    this.#attempt.update((attempt) => attempt + 1);
  }

  protected roleLabel(user: AdminUser): string {
    return this.#i18n.t(user.role === 'admin' ? 'role.admin' : 'role.operator');
  }

  protected async create(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      const value = this.form.getRawValue();
      await firstValueFrom(
        this.#api.create({
          fullName: value.fullName.trim(),
          email: value.email.trim(),
          password: value.password,
          role: 'operator',
        }),
      );
      this.form.reset();
      this.creating.set(false);
      this.retry();
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async toggleStatus(user: AdminUser): Promise<void> {
    const next = user.status === 'active' ? 'disabled' : 'active';
    if (next === 'disabled') {
      const result = await this.#confirm.open({
        titleKey: 'users.disable.warn',
        bodyKey: 'users.disable.confirm',
        confirmKey: 'users.form.status',
        tone: 'danger',
      });
      if (!result.confirmed) {
        return;
      }
    }
    try {
      await firstValueFrom(this.#api.update(user.id, { status: next }));
      this.retry();
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    }
  }
}
