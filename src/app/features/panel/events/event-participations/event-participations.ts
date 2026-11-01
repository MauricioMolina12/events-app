import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, forkJoin, map, switchMap } from 'rxjs';
import type { Establishment, Participation } from '@core/domain';
import { RouterLink } from '@angular/router';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter, ConfirmService } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { venueCode } from '@core/utils/ids';
import {
  ButtonDirective,
  EmptyState,
  Icon,
  Select,
  Skeleton,
  StatusBadge,
  type SelectChoice,
  type StatusKind,
} from '@shared/ui';
import { EstablishmentsApi } from '../../establishments/establishments.api';
import { EventConfigurationApi } from '../event-configuration.api';
import { seatCount, venueQuotaOverflow } from './participation-capacity';
import {
  formatCount,
  formatPercent,
  occupancyLevel,
  occupancyPercent,
  summarizeVenues,
  venueSnapshot,
  type OccupancyLevel,
  type VenueSnapshot,
} from './venue-occupancy';

const CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface EventParticipationData {
  readonly establishments: readonly Establishment[];
  readonly participations: readonly Participation[];
}

function seatValidator(control: AbstractControl): { seat: true } | null {
  return seatCount(control.value) === null ? { seat: true } : null;
}

@Component({
  selector: 'app-event-participations',
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    EmptyState,
    Icon,
    Select,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './event-participations.html',
  styleUrl: './event-participations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventParticipations {
  readonly eventId = input.required<string>();
  readonly eventCapacity = input.required<number>();
  /** The event form keeps the section title; the cupos page already has a page header. */
  readonly showHeader = input(true);

  readonly #api = inject(EventConfigurationApi);
  readonly #establishments = inject(EstablishmentsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #confirm = inject(ConfirmService);
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

  protected readonly query = signal('');
  protected readonly selectedId = signal<string | null>(null);
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
      validators: [Validators.required, seatValidator],
    }),
    companionCapacity: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, seatValidator],
    }),
  });

  readonly #submitted = signal(false);
  readonly #formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly #formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly isEditing = computed(() => this.editingId() !== null);
  protected readonly editingVenue = computed(
    () => this.snapshots().find((venue) => venue.id === this.editingId()) ?? null,
  );
  protected readonly editingVenueVisible = computed(() => {
    const id = this.editingId();
    return id !== null && this.visibleVenues().some((venue) => venue.id === id);
  });
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
  /** Seats already given to other venues. The one being edited is not counted twice. */
  protected readonly allocatedExceptEditing = computed(() => {
    const editingId = this.editingId();
    return (
      this.data()
        ?.participations.filter((item) => item.status !== 'cancelled' && item.id !== editingId)
        .reduce((total, item) => total + item.titularCapacity + item.companionCapacity, 0) ?? 0
    );
  });

  protected readonly remainingSeats = computed(() =>
    Math.max(0, this.eventCapacity() - this.allocatedExceptEditing()),
  );

  protected readonly venueMissing = computed(() => {
    this.#formStatus();
    return (
      this.#submitted() && !this.creatingVenue() && this.form.controls.establishmentId.invalid
    );
  });

  protected readonly venueNameMissing = computed(() => {
    this.#formStatus();
    return this.#submitted() && this.creatingVenue() && this.form.controls.venueName.invalid;
  });

  protected readonly titularInvalid = computed(() => {
    this.#formStatus();
    return this.#submitted() && this.form.controls.titularCapacity.invalid;
  });

  protected readonly companionInvalid = computed(() => {
    this.#formStatus();
    return this.#submitted() && this.form.controls.companionCapacity.invalid;
  });

  protected readonly quotaOverflow = computed(() => {
    this.#formValue();
    if (!this.#submitted()) {
      return null;
    }
    const titular = seatCount(this.form.controls.titularCapacity.value);
    const companion = seatCount(this.form.controls.companionCapacity.value);
    if (titular === null || companion === null) {
      return null;
    }
    return venueQuotaOverflow({
      eventCapacity: this.eventCapacity(),
      alreadyAllocated: this.allocatedExceptEditing(),
      titularCapacity: titular,
      companionCapacity: companion,
    });
  });

  protected readonly allocatedSeats = computed(() => {
    const data = this.data();
    if (data === null) {
      return 0;
    }
    return data.participations
      .filter((item) => item.status !== 'cancelled')
      .reduce((total, item) => total + item.titularCapacity + item.companionCapacity, 0);
  });
  protected readonly snapshots = computed(() => {
    const data = this.data();
    return data ? data.participations.map((item) => venueSnapshot(item)) : [];
  });
  protected readonly activeSnapshots = computed(() =>
    this.snapshots().filter((venue) => venue.status !== 'cancelled'),
  );
  protected readonly summary = computed(() => summarizeVenues(this.activeSnapshots()));
  protected readonly comparison = computed(() =>
    this.activeSnapshots()
      .slice()
      .sort(
        (left, right) => right.percent - left.percent || left.name.localeCompare(right.name, 'es'),
      ),
  );
  protected readonly visibleVenues = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('es');
    const venues = this.snapshots();
    if (!query) {
      return venues;
    }
    return venues.filter((venue) => {
      const city = venue.city?.toLocaleLowerCase('es') ?? '';
      return venue.name.toLocaleLowerCase('es').includes(query) || city.includes(query);
    });
  });
  protected readonly selected = computed(
    () => this.snapshots().find((venue) => venue.id === this.selectedId()) ?? null,
  );

  #pendingScroll = false;
  #draftBaseline: { titular: number; companion: number } | null = null;

  constructor() {
    this.form.controls.venueName.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      this.form.controls.venueCode.setValue(venueCode(name), { emitEvent: false });
    });

    afterRenderEffect(() => {
      const open = this.formOpen();
      this.editingId();
      if (!this.#pendingScroll || !open) {
        return;
      }
      const form = document.getElementById('participation-form');
      if (!form) {
        return;
      }
      this.#pendingScroll = false;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      form.querySelector<HTMLElement>('#titular-capacity')?.focus({ preventScroll: true });
    });
  }

  protected addEstablishment(): void {
    void this.#openCreate();
  }

  protected useExistingVenue(): void {
    this.#setCreatingVenue(false);
  }

  protected createNewVenue(): void {
    this.#setCreatingVenue(true);
  }

  protected editCapacity(participation: Participation): void {
    void this.#openEdit(participation);
  }

  protected cancelForm(): void {
    void this.#requestClose();
  }

  protected retry(): void {
    this.#attempt.update((attempt) => attempt + 1);
  }

  protected formatCount(value: number): string {
    return formatCount(value);
  }

  protected formatPercent(value: number): string {
    return formatPercent(value);
  }

  protected levelKey(level: OccupancyLevel): MessageKey {
    return `participations.level.${level}` as MessageKey;
  }

  protected selectVenue(id: string): void {
    this.selectedId.update((current) => (current === id ? null : id));
  }

  protected editVenue(id: string): void {
    if (this.editingId() === id && this.formOpen()) {
      void this.#requestClose();
      return;
    }
    const participation = this.data()?.participations.find((item) => item.id === id);
    if (participation) {
      void this.#openEdit(participation);
    }
  }

  protected onQuery(event: Event): void {
    const target = event.target;
    this.query.set(target instanceof HTMLInputElement ? target.value : '');
  }

  protected poolLabel(used: number, total: number): string {
    return this.#i18n.t('participations.detail.of', {
      used: formatCount(used),
      total: formatCount(total),
    });
  }

  protected trackWidth(venue: VenueSnapshot): number {
    return venue.capacity <= 0 ? 0 : venue.percent;
  }

  protected poolPercent(used: number, capacity: number, available: number): number {
    return occupancyPercent(used, capacity, available);
  }

  protected poolLevel(capacity: number, available: number, occupied: number): OccupancyLevel {
    return occupancyLevel(capacity, available, occupied);
  }

  protected statusKind(status: Participation['status']): StatusKind {
    return `participation.${status}`;
  }

  protected async save(): Promise<void> {
    this.#submitted.set(true);
    const value = this.form.getRawValue();
    const titular = seatCount(value.titularCapacity);
    const companion = seatCount(value.companionCapacity);
    const overflow =
      titular !== null && companion !== null
        ? venueQuotaOverflow({
            eventCapacity: this.eventCapacity(),
            alreadyAllocated: this.allocatedExceptEditing(),
            titularCapacity: titular,
            companionCapacity: companion,
          })
        : null;
    if (this.saving()) {
      return;
    }
    if (titular === null || companion === null || this.form.invalid || overflow) {
      this.form.markAllAsTouched();
      if (!overflow) {
        this.actionError.set('');
      }
      if (overflow) {
        this.actionError.set(
          this.#i18n.t('participations.validation.overflow', {
            titular: overflow.titularCapacity,
            companion: overflow.companionCapacity,
            requested: overflow.requested,
            remaining: overflow.remaining,
          }),
        );
      }
      this.#showFormError();
      return;
    }

    this.saving.set(true);
    this.actionError.set('');
    try {
      const editingId = this.editingId();
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
            titularCapacity: titular,
            companionCapacity: companion,
          }),
        );
      } else {
        await firstValueFrom(
          this.#api.createParticipation({
            eventId: this.eventId(),
            establishmentId,
            titularCapacity: titular,
            companionCapacity: companion,
          }),
        );
      }
      this.#closeForm();
      this.#attempt.update((attempt) => attempt + 1);
    } catch (error: unknown) {
      this.actionError.set(this.#errors.message(error));
      this.#showFormError();
    } finally {
      this.saving.set(false);
    }
  }

  async #openCreate(): Promise<void> {
    if (!(await this.#confirmDiscard())) {
      return;
    }
    this.editingId.set(null);
    this.#submitted.set(false);
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
    this.#draftBaseline = { titular: 0, companion: 0 };
    this.#setCreatingVenue(this.availableEstablishments().length === 0);
    this.#submitted.set(false);
    this.formOpen.set(true);
    this.#pendingScroll = true;
  }

  async #openEdit(participation: Participation): Promise<void> {
    if (this.editingId() !== participation.id && !(await this.#confirmDiscard())) {
      return;
    }
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
    this.#draftBaseline = {
      titular: participation.titularCapacity,
      companion: participation.companionCapacity,
    };
    this.#setCreatingVenue(false);
    this.#submitted.set(false);
    this.formOpen.set(true);
    this.#pendingScroll = true;
  }

  async #requestClose(): Promise<void> {
    if (!(await this.#confirmDiscard())) {
      return;
    }
    this.#closeForm();
  }

  async #confirmDiscard(): Promise<boolean> {
    if (!this.#draftDirty()) {
      return true;
    }
    const result = await this.#confirm.open({
      titleKey: 'participations.form.discardTitle',
      bodyKey: 'participations.form.discardBody',
      confirmKey: 'participations.form.discard',
      tone: 'primary',
    });
    return result.confirmed;
  }

  #draftDirty(): boolean {
    const baseline = this.#draftBaseline;
    if (!this.formOpen() || !baseline) {
      return false;
    }
    const value = this.form.getRawValue();
    return (
      Number(value.titularCapacity) !== baseline.titular ||
      Number(value.companionCapacity) !== baseline.companion ||
      value.venueName.trim() !== '' ||
      value.venueCity.trim() !== '' ||
      value.venueAddress.trim() !== '' ||
      (!this.editingId() && value.establishmentId !== '')
    );
  }

  #closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.creatingVenue.set(false);
    this.actionError.set('');
    this.#draftBaseline = null;
    this.#pendingScroll = false;
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

  /** Brings the message next to the button into view. The list above can hide a banner. */
  #showFormError(): void {
    queueMicrotask(() => {
      const form = document.getElementById('participation-form');
      const alert = form?.querySelector<HTMLElement>('[role="alert"]');
      (alert ?? form)?.scrollIntoView({ block: 'nearest' });
    });
  }
}
