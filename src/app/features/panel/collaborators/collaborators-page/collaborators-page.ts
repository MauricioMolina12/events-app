import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, switchMap } from 'rxjs';
import { TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { ButtonDirective, EmptyState, Icon, PageHeader, Skeleton } from '@shared/ui';
import {
  CollaboratorsApi,
  type CollaboratorGroup,
  type PanelModule,
} from '../collaborators.api';

const MODULES: readonly PanelModule[] = [
  'dashboard',
  'mesa',
  'ingreso',
  'eventos',
  'sedes',
  'cupos',
  'configuracion',
];

@Component({
  selector: 'app-collaborators-page',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonDirective, EmptyState, Icon, PageHeader, Skeleton],
  templateUrl: './collaborators-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaboratorsPage {
  readonly #api = inject(CollaboratorsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #attempt = signal(0);

  protected readonly modules = MODULES;
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly groupForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)],
    }),
  });
  protected readonly memberForm = new FormGroup({
    groupId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
  });
  protected readonly selectedModules = signal<ReadonlySet<PanelModule>>(new Set(['mesa', 'ingreso']));

  readonly state = toSignal(
    toObservable(this.#attempt).pipe(switchMap(() => this.#api.list().pipe(toAsyncState()))),
    { initialValue: loadingState<readonly CollaboratorGroup[]>() },
  );

  protected readonly groups = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : [];
  });

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });

  protected moduleLabel(module: PanelModule): MessageKey {
    return `collaborators.module.${module}` as MessageKey;
  }

  protected moduleOn(module: PanelModule): boolean {
    return this.selectedModules().has(module);
  }

  protected toggleModule(module: PanelModule): void {
    const next = new Set(this.selectedModules());
    if (next.has(module)) {
      next.delete(module);
    } else {
      next.add(module);
    }
    this.selectedModules.set(next);
  }

  protected async createGroup(): Promise<void> {
    if (this.groupForm.invalid || this.saving() || this.selectedModules().size === 0) {
      this.groupForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      await firstValueFrom(
        this.#api.createGroup(this.groupForm.controls.name.value.trim(), [...this.selectedModules()]),
      );
      this.groupForm.reset();
      this.#attempt.update((value) => value + 1);
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async addMember(): Promise<void> {
    if (this.memberForm.invalid || this.saving()) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.saveError.set('');
    try {
      const value = this.memberForm.getRawValue();
      await firstValueFrom(
        this.#api.addMember(value.groupId, {
          fullName: value.fullName.trim(),
          email: value.email.trim(),
          password: value.password,
        }),
      );
      this.memberForm.reset({ groupId: value.groupId, fullName: '', email: '', password: '' });
      this.#attempt.update((count) => count + 1);
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }
}
