import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { SessionStore } from '@core/auth';
import type { Page } from '@core/api';
import type {
  AdminUser,
  Event as ManagedEvent,
  EventStatus,
  RegistrationScope,
} from '@core/domain';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter, ConfirmService } from '@core/ui';
import { environment } from '@env/environment';
import { loadingState, loadedState, toAsyncState } from '@core/utils/async-state';
import { localInputToUtcIso, utcIsoToLocalInput } from '@core/utils/dates';
import { slugify } from '@core/utils/ids';
import { ButtonDirective, EventInvite, Icon, PageHeader, Select, Skeleton, type SelectChoice } from '@shared/ui';
import { EventParticipations } from '../event-participations/event-participations';
import { canManageEvent } from '../event-access';
import { UsersApi } from '../../users/users.api';
import { EventsApi, type CreateEventRequest, type UpdateEventRequest } from '../events.api';
import { EVENT_STATUS_TRANSITIONS } from '../event-status';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function timeZoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;
  if (!value.trim()) {
    return null;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return null;
  } catch {
    return { timeZone: true };
  }
}

function eventWindowsValidator(control: AbstractControl): ValidationErrors | null {
  const startsAt = control.get('startsAt')?.value as string;
  const endsAt = control.get('endsAt')?.value as string;
  const opensAt = control.get('registrationOpensAt')?.value as string;
  const closesAt = control.get('registrationClosesAt')?.value as string;
  const errors = {
    ...(startsAt && endsAt && startsAt > endsAt ? { eventWindow: true } : {}),
    ...(opensAt && closesAt && opensAt > closesAt ? { registrationWindow: true } : {}),
  };
  return Object.keys(errors).length > 0 ? errors : null;
}

@Component({
  selector: 'app-event-form-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    EventInvite,
    Icon,
    PageHeader,
    Skeleton,
    Select,
    EventParticipations,
  ],
  templateUrl: './event-form-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventFormPage {
  readonly id = input<string | undefined>(undefined);

  readonly #api = inject(EventsApi);
  readonly #users = inject(UsersApi);
  readonly #router = inject(Router);
  readonly #session = inject(SessionStore);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #confirm = inject(ConfirmService);
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ id: this.id(), attempt: this.#attempt() }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ id }) =>
        id ? this.#api.get(id).pipe(toAsyncState()) : of(loadedState<ManagedEvent | null>(null)),
      ),
    ),
    { initialValue: loadingState<ManagedEvent | null>() },
  );

  protected readonly editing = computed(() => Boolean(this.id()));
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly event = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(160)],
      }),
      slug: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(80),
          Validators.pattern(SLUG_PATTERN),
        ],
      }),
      description: new FormControl('', {
        nonNullable: true,
        validators: [Validators.maxLength(1000)],
      }),
      timezone: new FormControl(environment.defaultTimeZone, {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(64), timeZoneValidator],
      }),
      startsAt: new FormControl('', { nonNullable: true }),
      endsAt: new FormControl('', { nonNullable: true }),
      registrationOpensAt: new FormControl('', { nonNullable: true }),
      registrationClosesAt: new FormControl('', { nonNullable: true }),
      capacity: new FormControl(0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(100_000)],
      }),
      status: new FormControl<EventStatus>('draft', { nonNullable: true }),
      ownerId: new FormControl('', { nonNullable: true }),
      registrationScope: new FormControl<RegistrationScope>('per_venue', { nonNullable: true }),
      ticketBg: new FormControl('#111827', { nonNullable: true }),
      ticketAccent: new FormControl('#C81F68', { nonNullable: true }),
      ticketText: new FormControl('#111827', { nonNullable: true }),
      ticketTitleWeight: new FormControl(800, { nonNullable: true }),
      ticketTitleSize: new FormControl(22, { nonNullable: true }),
      ticketTitleX: new FormControl(8, { nonNullable: true }),
      ticketTitleY: new FormControl(18, { nonNullable: true }),
      ticketQrX: new FormControl(50, { nonNullable: true }),
      ticketQrY: new FormControl(55, { nonNullable: true }),
      ticketQrSize: new FormControl(184, { nonNullable: true }),
      ticketFieldWeight: new FormControl(700, { nonNullable: true }),
    },
    { validators: [eventWindowsValidator] },
  );
  protected readonly statusOptions = computed<readonly EventStatus[]>(() => {
    const current = this.event()?.status;
    return current ? [current, ...EVENT_STATUS_TRANSITIONS[current]] : [];
  });
  protected readonly statusChoices = computed<readonly SelectChoice[]>(() =>
    this.statusOptions().map((status) => ({ value: status, label: this.statusLabel(status) })),
  );
  readonly operators = toSignal(
    toObservable(this.editing).pipe(
      switchMap((editing) =>
        editing
          ? of(
              loadedState({
                items: [],
                meta: { total: 0, limit: 0, offset: 0 },
              }),
            )
          : this.#users.list({ role: 'operator', status: 'active', limit: 100 }).pipe(toAsyncState()),
      ),
    ),
    { initialValue: loadingState<Page<AdminUser>>() },
  );
  protected readonly ownerChoices = computed<readonly SelectChoice[]>(() => {
    const state = this.operators();
    if (state.status !== 'loaded') {
      return [];
    }
    return state.value.items.map((user) => ({
      value: user.id,
      label: `${user.fullName} · ${user.email}`,
    }));
  });
  protected readonly archiving = computed(
    () =>
      this.event() !== null &&
      this.form.controls.status.value === 'archived' &&
      this.event()?.status !== 'archived',
  );

  #loadedId: string | null = null;

  constructor() {
    this.form.controls.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      this.form.controls.slug.setValue(slugify(name), { emitEvent: false });
    });

    effect(() => {
      const event = this.event();
      if (!event || event.id === this.#loadedId) {
        return;
      }
      if (!canManageEvent(this.#session.user(), event)) {
        void this.#router.navigateByUrl('/panel/forbidden');
        return;
      }
      this.#loadedId = event.id;
      this.form.reset({
        name: event.name,
        slug: slugify(event.name),
        description: event.description ?? '',
        timezone: event.timezone,
        startsAt: utcIsoToLocalInput(event.startsAt, event.timezone),
        endsAt: utcIsoToLocalInput(event.endsAt, event.timezone),
        registrationOpensAt: utcIsoToLocalInput(event.registrationOpensAt, event.timezone),
        registrationClosesAt: utcIsoToLocalInput(event.registrationClosesAt, event.timezone),
        capacity: event.capacity,
        status: event.status,
        registrationScope: event.registrationScope ?? 'per_venue',
        ticketBg: event.ticketDesign?.bgColor ?? '#111827',
        ticketAccent: event.ticketDesign?.accentColor ?? '#C81F68',
        ticketText: event.ticketDesign?.textColor ?? '#111827',
        ticketTitleWeight: event.ticketDesign?.titleWeight ?? 800,
        ticketTitleSize: event.ticketDesign?.titleSize ?? 22,
        ticketTitleX: event.ticketDesign?.titleX ?? 8,
        ticketTitleY: event.ticketDesign?.titleY ?? 18,
        ticketQrX: event.ticketDesign?.qrX ?? 50,
        ticketQrY: event.ticketDesign?.qrY ?? 55,
        ticketQrSize: event.ticketDesign?.qrSize ?? 184,
        ticketFieldWeight: event.ticketDesign?.fieldWeight ?? 700,
      });
    });
  }

  protected statusLabel(status: EventStatus): string {
    return this.#i18n.t(`status.event.${status}`);
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

    if (this.archiving()) {
      const result = await this.#confirm.open({
        titleKey: 'events.transition.title',
        bodyKey: 'events.transition.archivedWarn',
        confirmKey: 'events.transition.archive',
        tone: 'danger',
      });
      if (!result.confirmed) {
        return;
      }
    }

    this.saving.set(true);
    this.saveError.set('');
    try {
      const value = this.form.getRawValue();
      const slug = slugify(value.name.trim());
      const fields = {
        name: value.name.trim(),
        slug,
        description: value.description.trim() || null,
        timezone: value.timezone.trim(),
        startsAt: localInputToUtcIso(value.startsAt, value.timezone) || null,
        endsAt: localInputToUtcIso(value.endsAt, value.timezone) || null,
        registrationOpensAt: localInputToUtcIso(value.registrationOpensAt, value.timezone) || null,
        registrationClosesAt:
          localInputToUtcIso(value.registrationClosesAt, value.timezone) || null,
        capacity: Number(value.capacity),
        registrationScope: value.registrationScope,
        ticketDesign: {
          bgColor: value.ticketBg,
          accentColor: value.ticketAccent,
          textColor: value.ticketText,
          titleWeight: Number(value.ticketTitleWeight),
          titleSize: Number(value.ticketTitleSize),
          titleX: Number(value.ticketTitleX),
          titleY: Number(value.ticketTitleY),
          qrX: Number(value.ticketQrX),
          qrY: Number(value.ticketQrY),
          qrSize: Number(value.ticketQrSize),
          fieldWeight: Number(value.ticketFieldWeight),
        },
      };

      if (this.id()) {
        const request: UpdateEventRequest = { ...fields, status: value.status };
        await firstValueFrom(this.#api.update(this.id()!, request));
        await this.#router.navigate(['/panel/eventos']);
      } else {
        if (!value.ownerId) {
          this.form.controls.ownerId.setErrors({ required: true });
          return;
        }
        const request: CreateEventRequest = { ...fields, ownerId: value.ownerId };
        const event = await firstValueFrom(this.#api.create(request));
        await this.#router.navigate(['/panel/eventos', event.id, 'editar']);
      }
    } catch (error: unknown) {
      this.saveError.set(this.#errors.message(error));
    } finally {
      this.saving.set(false);
    }
  }

}
