import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, forkJoin, map, switchMap } from 'rxjs';
import type { Establishment, Participation } from '@core/domain';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { venueCode } from '@core/utils/ids';
import {
  ButtonDirective,
  EmptyState,
  Select,
  Skeleton,
  StatusBadge,
  type SelectChoice,
  type StatusKind,
} from '@shared/ui';
import { EstablishmentsApi } from '../../establishments/establishments.api';
import { EventConfigurationApi } from '../event-configuration.api';

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface EventParticipationData {
  readonly establishments: readonly Establishment[];
  readonly participations: readonly Participation[];
}

const MAX_CAPACITY = 100_000;

@Component({
  selector: 'app-event-participations',
  imports: [ReactiveFormsModule, TranslatePipe, ButtonDirective, EmptyState, Select, Skeleton, StatusBadge],
  templateUrl: './event-participations.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventParticipations {
  readonly eventId = input.required<string>();
  readonly eventCapacity = input.required<number>();

  readonly #api = inject(EventConfigurationApi);
  readonly #establishments = inject(EstablishmentsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ eventId: this.eventId(), attempt: this.#attempt() }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ eventId }) =>
        forkJoin({
          establishments: this.#api.listActiveEstablishments(),
          participations: this.#api.listParticipations(eventId),
        }).pipe(
          map(({ establishments, participations }) => ({
            establishments: establishments.items,
            participations: participations.items,
          })),
          toAsyncState(),
        ),
      ),
    ),
    { initialValue: loadingState<EventParticipationData>() },
  );

  protected readonly formOpen = signal(false);
  protected readonly creatingVenue = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly actionError = signal('');
  protected readonly form = new FormGroup({
    establishmentId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    venueName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(160)],
    }),
    venueCode: new FormControl('', { nonNullable: true }),
    venueCity: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    venueAddress: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    titularCapacity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(MAX_CAPACITY)],
    }),
    companionCapacity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(MAX_CAPACITY)],
    }),
  });

  protected readonly isEditing = computed(() => this.editingId() !== null);
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });
  protected readonly availableEstablishments = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return [];
    }
    const assigned = new Set(state.value.participations.map((item) => item.establishmentId));
    return state.value.establishments.filter((item) => !assigned.has(item.id));
  });
  protected readonly venueChoices = computed<readonly SelectChoice[]>(() => [
    { value: '', label: this.#i18n.t('participations.form.chooseEstablishment') },
    ...this.availableEstablishments().map((item) => ({
      value: item.id,
      label: item.city ? `${item.name} · ${item.city}` : item.name,
    })),
  ]);
  protected readonly allocatedSeats = computed(() => {
    const data = this.data();
    if (data === null) {
      return 0;
    }
    return data.participations
      .filter((item) => item.status !== 'cancelled')
      .reduce((total, item) => total + item.titularCapacity + item.companionCapacity, 0);
  });

  constructor() {
    this.form.controls.venueName.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      this.form.controls.venueCode.setValue(venueCode(name), { emitEvent: false });
    });
  }

  protected addEstablishment(): void {
    this.editingId.set(null);
    this.actionError.set('');
    this.form.reset({
      establishmentId: '',
      venueName: '',
      venueCode: '',
      venueCity: '',
      venueAddress: '',
      titularCapacity: 0,
      companionCapacity: 0,
    });
    this.#setCreatingVenue(this.availableEstablishments().length === 0);
    this.formOpen.set(true);
  }

  protected useExistingVenue(): void {
    this.#setCreatingVenue(false);
  }

  protected createNewVenue(): void {
    this.#setCreatingVenue(true);
  }

  protected editCapacity(participation: Participation): void {
    this.editingId.set(participation.id);
    this.actionError.set('');
    this.form.reset({
      establishmentId: participation.establishmentId,
      venueName: '',
      venueCode: '',
      venueCity: '',
      venueAddress: '',
      titularCapacity: participation.titularCapacity,
      companionCapacity: participation.companionCapacity,
    });
    this.#setCreatingVenue(false);
    this.formOpen.set(true);
  }

  protected cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.creatingVenue.set(false);
    this.actionError.set('');
  }

  protected retry(): void {
    this.#attempt.update((attempt) => attempt + 1);
  }

  protected statusKind(status: Participation['status']): StatusKind {
    return `participation.${status}`;
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.actionError.set('');
    try {
      const value = this.form.getRawValue();
      const editingId = this.editingId();
      const allocatedWithoutCurrent =
        this.data()
          ?.participations.filter((item) => item.status !== 'cancelled' && item.id !== editingId)
          .reduce((total, item) => total + item.titularCapacity + item.companionCapacity, 0) ?? 0;
      if (
        allocatedWithoutCurrent + value.titularCapacity + value.companionCapacity >
        this.eventCapacity()
      ) {
        this.actionError.set(this.#i18n.t('participations.capacity.overflow'));
        return;
      }

      let establishmentId = value.establishmentId;
      if (!editingId && this.creatingVenue()) {
        const created = await firstValueFrom(
          this.#establishments.create({
            name: value.venueName.trim(),
            code: venueCode(value.venueName.trim()),
            city: value.venueCity.trim() || null,
            address: value.venueAddress.trim() || null,
          }),
        );
        establishmentId = created.id;
      }

      if (editingId) {
        await firstValueFrom(
          this.#api.updateCapacities(editingId, {
            titularCapacity: value.titularCapacity,
            companionCapacity: value.companionCapacity,
          }),
        );
      } else {
        await firstValueFrom(
          this.#api.createParticipation({
            eventId: this.eventId(),
            establishmentId,
            titularCapacity: value.titularCapacity,
            companionCapacity: value.companionCapacity,
          }),
        );
      }
      this.cancelForm();
      this.#attempt.update((attempt) => attempt + 1);
    } catch (error: unknown) {
      this.actionError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }

  #setCreatingVenue(creating: boolean): void {
    this.creatingVenue.set(creating);
    const establishmentId = this.form.controls.establishmentId;
    const venueName = this.form.controls.venueName;
    const venueCodeControl = this.form.controls.venueCode;
    if (creating) {
      establishmentId.clearValidators();
      establishmentId.setValue('');
      venueName.setValidators([Validators.required, Validators.maxLength(160)]);
      venueCodeControl.setValidators([
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(CODE_PATTERN),
      ]);
    } else {
      establishmentId.setValidators([Validators.required]);
      venueName.clearValidators();
      venueCodeControl.clearValidators();
      venueName.setValue('');
      venueCodeControl.setValue('');
      this.form.controls.venueCity.setValue('');
      this.form.controls.venueAddress.setValue('');
    }
    establishmentId.updateValueAndValidity({ emitEvent: false });
    venueName.updateValueAndValidity({ emitEvent: false });
    venueCodeControl.updateValueAndValidity({ emitEvent: false });
  }
}
