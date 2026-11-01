import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import type { Establishment, EstablishmentStatus } from '@core/domain';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, loadedState, toAsyncState } from '@core/utils/async-state';
import { venueCode } from '@core/utils/ids';
import { ButtonDirective, Combobox, Icon, PageHeader, Select, Skeleton, type SelectChoice } from '@shared/ui';
import { CatalogApi } from '@features/catalog/catalog.api';
import { EstablishmentsApi } from '../establishments.api';
import { ESTABLISHMENT_STATUSES } from '../establishment-status';

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-establishment-form-page',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ButtonDirective, Combobox, Icon, PageHeader, Select, Skeleton],
  templateUrl: './establishment-form-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentFormPage {
  readonly id = input<string | undefined>(undefined);

  readonly #api = inject(EstablishmentsApi);
  readonly #router = inject(Router);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ id: this.id(), attempt: this.#attempt() }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ id }) =>
        id ? this.#api.get(id).pipe(toAsyncState()) : of(loadedState<Establishment | null>(null)),
      ),
    ),
    { initialValue: loadingState<Establishment | null>() },
  );

  protected readonly editing = computed(() => Boolean(this.id()));
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly statuses = ESTABLISHMENT_STATUSES;
  protected readonly statusChoices = computed<readonly SelectChoice[]>(() =>
    this.statuses.map((status) => ({ value: status, label: this.statusLabel(status) })),
  );
  protected readonly establishment = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly deactivating = computed(
    () =>
      this.establishment()?.status === 'active' && this.form.controls.status.value === 'inactive',
  );
  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(160)],
    }),
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(32),
        Validators.pattern(CODE_PATTERN),
      ],
    }),
    cityId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    status: new FormControl<EstablishmentStatus>('active', { nonNullable: true }),
  });

  #loadedId: string | null = null;
  readonly #places = toSignal(
    inject(CatalogApi).places().pipe(
      map((places) => places.departments),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  protected readonly cityChoices = computed<readonly SelectChoice[]>(() =>
    this.#places().flatMap((department) =>
      department.cities.map((city) => ({
        value: city.id,
        label: `${city.name}, ${department.name}`,
      })),
    ),
  );

  constructor() {
    this.form.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (this.editing()) {
        return;
      }
      this.form.controls.code.setValue(venueCode(name), { emitEvent: false });
    });

    effect(() => {
      const establishment = this.establishment();
      const choices = this.cityChoices();
      if (!establishment || establishment.id === this.#loadedId) {
        return;
      }
      let cityId = establishment.cityId ?? '';
      if (!cityId && establishment.city) {
        const needle = `${establishment.city.toLowerCase()},`;
        cityId = choices.find((choice) => choice.label.toLowerCase().startsWith(needle))?.value ?? '';
      }
      if (!cityId && !establishment.cityId && choices.length === 0 && establishment.city) {
        return;
      }
      this.#loadedId = establishment.id;
      this.form.reset({
        name: establishment.name,
        code: establishment.code,
        cityId,
        address: establishment.address ?? '',
        status: establishment.status,
      });
    });
  }

  protected statusLabel(status: EstablishmentStatus): string {
    return this.#i18n.t(`status.establishment.${status}`);
  }

  protected retry(): void {
    this.#attempt.update((attempt) => attempt + 1);
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    try {
      const value = this.form.getRawValue();
      const fields = {
        name: value.name.trim(),
        cityId: value.cityId,
        address: value.address.trim() || null,
      };

      if (this.id()) {
        await firstValueFrom(
          this.#api.update(this.id()!, { ...fields, status: value.status }),
        );
      } else {
        await firstValueFrom(
          this.#api.create({ ...fields, code: venueCode(value.name.trim()) }),
        );
      }
      await this.#router.navigate(['/panel/sedes']);
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }
}
