import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { DOCUMENT, Location } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, map, of, switchMap } from 'rxjs';
import { toApiError, type ApiError } from '@core/api';
import {
  MAX_COMPANIONS_PER_REGISTRATION,
  type CreateRegistrationRequest,
  type PublicEvent,
  type PublicParticipation,
} from '@core/domain';
import { I18nService, TranslatePipe, type MessageKey, type MessageParams } from '@core/i18n';
import { readReturnTo } from '@core/navigation/return-to';
import { ApiErrorPresenter, ConfirmService, ToastService } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { describeWindow, toZonedDateTimeDisplay } from '@core/utils/dates';
import { DOCUMENT_TYPES, documentTypeLabel, type DocumentType } from '@core/utils/documents';
import {
  ButtonDirective,
  Combobox,
  EmptyState,
  FieldControlDirective,
  FormField,
  Icon,
  Skeleton,
  StatusBadge,
  type StatusKind,
} from '@shared/ui';
import { CatalogApi } from '../catalog.api';
import {
  MIN_NAME_LENGTH,
  companionGroup,
  companionRequests,
  documentValidator,
  validationMessage,
  type CompanionForm,
} from '../companion-form';
import {
  participationStatusKind,
  registrableReason,
  registrationSede,
} from '../participation-availability';
import { ReceiptStore, type ReceiptContext } from '../receipt.store';

interface FlowStep {
  readonly index: number;
  readonly labelKey: MessageKey;
}

const SKELETON_ROWS: readonly number[] = [1, 2, 3];

/** Same shape the API accepts: seven digits up to twenty characters of furniture. */
const PHONE_PATTERN = /^[+()\d][\d\s()+-]{6,19}$/;

/** The three beats of a per-sede alta. Step 3 lives on the receipt route. */
const FLOW_STEPS: readonly FlowStep[] = [
  { index: 1, labelKey: 'register.step.sede' },
  { index: 2, labelKey: 'register.step.data' },
  { index: 3, labelKey: 'register.step.receipt' },
];

/** Fields that decide the progress bar: the four the server refuses to take empty. */
const TITULAR_FIELDS = ['documentNumber', 'fullName', 'email', 'phone'] as const;

/** One entry of the error summary: what to call the field and the input it points at. */
interface InvalidField {
  readonly anchor: string;
  readonly labelKey: MessageKey;
  readonly labelParams?: MessageParams;
}

/**
 * Every titular control the API can reject, with the id of its input. The anchors are the
 * ids the template already uses, so this table is the single place that has to follow a
 * rename — which is also why it is data (`Object.keys` drives the loop) and not code.
 */
const TITULAR_SUMMARY = {
  documentType: { anchor: 'regDocumentType', labelKey: 'register.documentType' },
  documentNumber: { anchor: 'regDocumentNumber', labelKey: 'register.documentNumber' },
  fullName: { anchor: 'regFullName', labelKey: 'register.fullName' },
  email: { anchor: 'regEmail', labelKey: 'register.email' },
  phone: { anchor: 'regPhone', labelKey: 'register.phone' },
  requiresElectronicInvoice: {
    anchor: 'regInvoiceYes',
    labelKey: 'register.electronicInvoice',
  },
  deliveryMode: { anchor: 'regDeliveryVenue', labelKey: 'register.delivery.title' },
  address: { anchor: 'regAddress', labelKey: 'register.delivery.address' },
  carrier: { anchor: 'regCarrier', labelKey: 'register.delivery.carrier' },
  deliveryCityId: { anchor: 'regDeliveryCity', labelKey: 'register.delivery.city' },
} as const satisfies Record<string, { anchor: string; labelKey: MessageKey }>;

/** Suffix of the input id for each `companions.<index>.<field>` path we can point at. */
const COMPANION_PATH_SUFFIX = new Map<string, string>([
  ['fullName', 'Name'],
  ['documentNumber', 'DocumentNumber'],
]);

/** `companions.0.fullName` and friends, as they travel in `ApiError.details.issues`. */
const COMPANION_PATH = /^companions\.(\d+)\.(.+)$/;

function phoneValidator(control: AbstractControl): { phone: true } | null {
  const value = (control.value as string | null)?.trim() ?? '';
  if (value.length === 0) {
    return null;
  }
  return PHONE_PATTERN.test(value) ? null : { phone: true };
}

/**
 * Alta (`/eventos/:slug/inscripcion`).
 *
 * The sede is resolved **before** the form: capacity and the inscription window belong
 * to the participation, so the numbers shown next to the fields are the ones the server
 * re-checks on submit. On success the receipt stays on this device (there is no public
 * read endpoint) and the page hands over to `/inscripcion/:id`.
 *
 * Two details are UX, not decoration: the submit bar sticks to the bottom on phones
 * (the primary action must never be a scroll away) and a failed submit moves the focus
 * to the first field the browser could not accept.
 */
@Component({
  selector: 'app-registration-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    Combobox,
    EmptyState,
    FieldControlDirective,
    FormField,
    Icon,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './registration-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationPage {
  readonly slug = input.required<string>();
  /** `?sede=` — the participation the previous screen named. Wins over a listed-first default. */
  readonly sede = input<string | undefined>(undefined);

  readonly #api = inject(CatalogApi);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #location = inject(Location);
  readonly #receipts = inject(ReceiptStore);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #toast = inject(ToastService);
  readonly #i18n = inject(I18nService);
  readonly #confirm = inject(ConfirmService);
  readonly #document = inject(DOCUMENT);
  protected readonly returnTo = signal<string | null>(null);
  protected readonly returnLabelKey = computed<MessageKey>(() =>
    this.returnTo()?.startsWith('/panel/mesa') ? 'register.backToDesk' : 'app.return',
  );

  /** Bumped by `retry()`; part of the request so a retry re-subscribes. */
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ slug: this.slug(), attempt: this.#attempt() }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ slug }) => this.#api.getEvent(slug).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<PublicEvent>() },
  );

  readonly #saving = signal(false);
  readonly #submitted = signal(false);
  readonly #submitError = signal<ApiError | null>(null);
  readonly #serverErrors = signal<Record<string, string>>({});
  readonly #companionCount = signal(0);
  /** Announced to screen readers when the sede changes, since the form below it resets. */
  readonly #announcement = signal('');

  #selectionOwner: string | null = null;

  protected readonly placeholders = SKELETON_ROWS;
  protected readonly documentTypes = DOCUMENT_TYPES;

  /** Set once the alta succeeds, so leaving for the receipt does not ask to discard it. */
  #finished = false;

  /** Chosen sede; `undefined` only while the event is still loading. */
  protected readonly selectedId = signal<string | undefined>(undefined);

  protected readonly form = new FormGroup({
    documentType: new FormControl<DocumentType>('CC', { nonNullable: true }),
    documentNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, documentValidator],
    }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_NAME_LENGTH)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, phoneValidator],
    }),
    requiresElectronicInvoice: new FormControl<boolean | null>(null, {
      validators: [Validators.required],
    }),
    deliveryMode: new FormControl<'venue' | 'other' | ''>('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    carrier: new FormControl('', { nonNullable: true }),
    deliveryCityId: new FormControl('', { nonNullable: true }),
    companions: new FormArray<CompanionForm>([]),
  });

  readonly #event = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });

  /** The form is not a signal, so anything derived from it re-reads on these events. */
  readonly #formEvents = toSignal(this.form.events, { initialValue: null });

  /** Signal queries reject `#private` members, so this one is `protected` and HTML-invisible. */
  protected readonly formRef = viewChild<ElementRef<HTMLFormElement>>('registrationForm');

  protected readonly saving = this.#saving.asReadonly();
  protected readonly submitted = this.#submitted.asReadonly();
  protected readonly announcement = this.#announcement.asReadonly();

  /**
   * Chosen sede, falling back to the default one. Reading the fallback here (instead of
   * relying on the effect below to have run) keeps the first paint after a load from
   * flashing an empty form.
   */
  protected readonly selected = computed<PublicParticipation | undefined>(() => {
    const event = this.#event();
    if (!event) {
      return undefined;
    }
    const id = this.selectedId();
    return (
      event.participations.find((participation) => participation.id === id) ??
      this.#defaultSede(event)
    );
  });

  /** Start of the event, already formatted for the reader's locale and the event's zone. */
  protected readonly whenLabel = computed(() => {
    const event = this.#event();
    return event?.startsAt ? toZonedDateTimeDisplay(event.startsAt, event.timezone) : '';
  });

  protected readonly allVenues = computed(() => this.#event()?.registrationScope === 'all_venues');

  protected readonly steps = computed(() => FLOW_STEPS);

  protected readonly eventPath = computed(() => ['/eventos', this.slug()] as const);

  /** The contextual return already points at the event, so a second exit would repeat it. */
  protected readonly showEventExit = computed(() => this.returnTo() !== `/eventos/${this.slug()}`);

  protected readonly currentStep = computed(() => (this.selected() ? 2 : 1));

  /**
   * Companions the sede can still take, capped by the registration limit. `0` disables
   * the "add" button instead of letting the server reject the whole page.
   */
  protected readonly maxCompanions = computed(() => {
    const participation = this.selected();
    if (!participation) {
      return 0;
    }
    return Math.min(
      MAX_COMPANIONS_PER_REGISTRATION,
      Math.max(0, participation.availableCompanions),
    );
  });

  protected readonly canAddCompanion = computed(
    () => this.#companionCount() < this.maxCompanions(),
  );

  /** Required titular fields already accepted: what the progress bar shows. */
  protected readonly completion = computed(() => {
    this.#formEvents();
    const done = TITULAR_FIELDS.filter((name) => {
      const control: AbstractControl = this.form.controls[name];
      const value = control.value as string;
      return control.valid && value.trim().length > 0;
    }).length;
    const invoiceChosen = this.form.controls.requiresElectronicInvoice.valid ? 1 : 0;
    return Math.round(((done + invoiceChosen) / (TITULAR_FIELDS.length + 1)) * 100);
  });

  /** `null` until the person picks Sí or No. */
  protected readonly invoiceChoice = computed(() => {
    this.#formEvents();
    return this.form.controls.requiresElectronicInvoice.value;
  });

  protected readonly asksDelivery = computed(
    () => this.#event()?.features?.includes('delivery') ?? false,
  );
  protected readonly venueCityName = computed(() => this.selected()?.establishment.city ?? '');
  protected readonly venueCityId = computed(() => this.selected()?.establishment.cityId ?? null);
  protected readonly deliveryChoice = toSignal(this.form.controls.deliveryMode.valueChanges, {
    initialValue: this.form.controls.deliveryMode.value,
  });
  readonly #places = toSignal(
    this.#api.places().pipe(
      map((places) => places.departments),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  protected readonly cityOptions = computed(() => {
    const skip = this.deliveryChoice() === 'other' ? this.venueCityId() : null;
    const options: { value: string; label: string; hint: string }[] = [];
    for (const department of this.#places()) {
      for (const city of department.cities) {
        if (city.id !== skip) {
          options.push({ value: city.id, label: city.name, hint: department.name });
        }
      }
    }
    return options;
  });
  #deliveryRules = '';

  /**
   * What the error summary lists, in the order the eye meets the fields: every control the
   * local validators rejected after a submit, plus whatever the server flagged in its own
   * words. Each entry carries the id of the input to jump to, which is what turns the
   * summary into a navigation aid instead of a count.
   */
  protected readonly invalidFields = computed<readonly InvalidField[]>(() => {
    this.#formEvents();
    const fields: InvalidField[] = [];
    const seen = new Set<string>();
    const add = (field: InvalidField): void => {
      if (!seen.has(field.anchor)) {
        seen.add(field.anchor);
        fields.push(field);
      }
    };

    if (this.#submitted()) {
      for (const name of Object.keys(TITULAR_SUMMARY) as (keyof typeof TITULAR_SUMMARY)[]) {
        if (this.form.controls[name].invalid) {
          add({ ...TITULAR_SUMMARY[name] });
        }
      }
      this.form.controls.companions.controls.forEach((companion, index) => {
        const broken =
          companion.controls.fullName.invalid || companion.controls.documentNumber.invalid;
        if (broken) {
          add({
            anchor: `comp${index}Name`,
            labelKey: 'register.companions.item',
            labelParams: { index: index + 1 },
          });
        }
      });
    }

    for (const path of Object.keys(this.#serverErrors())) {
      const field = this.#anchorFor(path);
      if (field) {
        add(field);
      }
    }

    return fields;
  });

  protected readonly error = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.error : null;
  });

  protected readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? this.#errors.message(error) : '';
  });

  protected readonly isOffline = computed(() => {
    const error = this.error();
    return error ? this.#errors.isOffline(error) : false;
  });

  /** A 404 is a missing event, not a failure: the screen says so instead of "error". */
  protected readonly isMissing = computed(() => {
    const error = this.error();
    return error ? this.#errors.isNotFound(error) : false;
  });

  /** Failure of the last alta. It stays on screen: the user may need the support code. */
  protected readonly submitMessage = computed(() => {
    const error = this.#submitError();
    return error ? this.#errors.message(error) : '';
  });

  protected readonly submitOffline = computed(() => {
    const error = this.#submitError();
    return error ? this.#errors.isOffline(error) : false;
  });

  protected readonly submitSupportCode = computed(() => {
    const error = this.#submitError();
    return error ? (this.#errors.supportCode(error) ?? '') : '';
  });

  /** `undefined` while the chosen sede can take the registration. */
  protected readonly selectedBlocked = computed<MessageKey | undefined>(() => {
    const participation = this.selected();
    return participation ? this.blockedReason(participation) : undefined;
  });

  /**
   * A blocked sede never blocks the *page*: the form is hidden and the reason is shown
   * instead, so the visitor can go back up and pick another one.
   */
  protected readonly canSubmit = computed(
    () => this.selected() !== undefined && this.selectedBlocked() === undefined,
  );

  constructor() {
    this.#syncReturn();
    this.#router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.#syncReturn());

    // The event loads once per slug; the navigation state only pre-selects among its sedes.
    effect(() => {
      const event = this.#event();
      const requested = this.#requestedSede();
      const owner = `${event?.id ?? ''}|${requested ?? ''}`;
      if (!event || this.#selectionOwner === owner) {
        return;
      }
      this.#selectionOwner = owner;
      this.selectedId.set(this.#defaultSede(event)?.id);
    });

    effect(() => {
      const asks = this.asksDelivery();
      const cityId = this.venueCityId();
      const mode = this.deliveryChoice();
      const signature = `${asks}|${cityId ?? ''}|${mode}`;
      if (signature === this.#deliveryRules) {
        return;
      }
      this.#deliveryRules = signature;
      const address = this.form.controls.address;
      const carrier = this.form.controls.carrier;
      const city = this.form.controls.deliveryCityId;
      const deliveryMode = this.form.controls.deliveryMode;
      const other = !asks ? false : cityId === null || mode === 'other';
      if (!asks) {
        deliveryMode.clearValidators();
        address.clearValidators();
        carrier.clearValidators();
        city.clearValidators();
      } else {
        deliveryMode.setValidators(cityId ? [Validators.required] : []);
        address.setValidators([Validators.required, Validators.minLength(5), Validators.maxLength(180)]);
        if (other) {
          carrier.setValidators([Validators.required, Validators.minLength(2), Validators.maxLength(80)]);
          city.setValidators([Validators.required]);
          if (cityId === null && deliveryMode.value !== 'other') {
            deliveryMode.setValue('other', { emitEvent: false });
          }
        } else {
          carrier.clearValidators();
          city.clearValidators();
          carrier.setValue('', { emitEvent: false });
          city.setValue('', { emitEvent: false });
        }
      }
      for (const control of [deliveryMode, address, carrier, city]) {
        control.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  /**
   * The router calls this before leaving. Typed data stays on the form until the person
   * confirms, and a finished alta does not ask again.
   */
  confirmLeave(): boolean | Promise<boolean> {
    if (this.#finished || !this.#hasDraft()) {
      return true;
    }
    return this.#confirm
      .open({
        titleKey: 'register.leave.title',
        bodyKey: 'register.leave.body',
        confirmKey: 'register.leave.confirm',
        tone: 'danger',
      })
      .then((result) => result.confirmed);
  }

  /** Scrolls back to the sede list without clearing what was already typed. */
  protected focusSede(): void {
    this.#document.getElementById('registro-sede')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  protected stepState(index: number): 'done' | 'current' | 'pending' {
    const current = this.currentStep();
    if (index < current) {
      return 'done';
    }
    return index === current ? 'current' : 'pending';
  }

  protected isSelected(participation: PublicParticipation): boolean {
    return this.selected()?.id === participation.id;
  }

  /**
   * Switching sede resets the companions: their seats belong to the sede that was
   * chosen, so keeping them would silently move people to another location.
   */
  protected chooseSede(id: string): void {
    if (this.selectedId() === id) {
      return;
    }
    this.selectedId.set(id);
    void this.#router.navigate([], {
      relativeTo: this.#route,
      queryParams: { sede: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.form.controls.companions.clear();
    this.#companionCount.set(0);
    const name = this.selected()?.establishment.name;
    this.#announcement.set(
      name ? this.#i18n.t('register.sede.selected', { name }) : this.#i18n.t('app.loading'),
    );
  }

  protected addCompanion(): void {
    if (!this.canAddCompanion()) {
      return;
    }
    this.form.controls.companions.push(companionGroup());
    this.#companionCount.set(this.form.controls.companions.length);
  }

  protected removeCompanion(index: number): void {
    this.form.controls.companions.removeAt(index);
    this.#companionCount.set(this.form.controls.companions.length);
  }

  protected documentLabel(type: DocumentType): string {
    return documentTypeLabel(type);
  }

  /** Effective window of the chosen sede: its own dates when declared, else the event's. */
  protected windowLabel(participation: PublicParticipation): string {
    return describeWindow(
      participation.registrationOpensAt,
      participation.registrationClosesAt,
      this.#event()?.timezone ?? 'UTC',
    );
  }

  protected participationKind(participation: PublicParticipation): StatusKind {
    return participationStatusKind(participation);
  }

  /**
   * Why a sede cannot take the alta, in the order the server would reject it.
   * `undefined` means the form is offered. The rule is shared with the detail page and the
   * `/inscripcion` gate, so no screen can offer an alta another one refuses.
   */
  protected blockedReason(participation: PublicParticipation): MessageKey | undefined {
    return registrableReason(participation);
  }

  /**
   * Message for a field: the server's own text when it sent one (it knows better than
   * the client), else the local validator translated. Nothing is painted until the field
   * was touched or a submit was attempted.
   */
  protected controlError(control: AbstractControl, path: string): string | undefined {
    const server = this.#serverErrors()[path];
    if (server) {
      return server;
    }
    if (!control.touched && !this.#submitted()) {
      return undefined;
    }
    return validationMessage(control, this.#i18n);
  }

  protected async submit(): Promise<void> {
    this.#submitted.set(true);
    const event = this.#event();
    const participation = this.selected();
    if (!event || !participation || this.#saving() || !this.canSubmit()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.#focusFirstInvalid();
      return;
    }

    this.#saving.set(true);
    this.#submitError.set(null);
    this.#serverErrors.set({});
    try {
      const receipt = await firstValueFrom(
        this.#api.createRegistration(this.#buildRequest(participation)),
      );
      this.#receipts.save({
        receipt,
        context: this.#receiptContext(event, participation, receipt.companionsCount),
      });
      this.#toast.success('register.success.title');
      this.#finished = true;
      const returnTo = this.returnTo();
      const left = await this.#router.navigate(['/inscripcion', receipt.id], {
        queryParams: { evento: event.slug },
        replaceUrl: true,
        state: returnTo ? { returnTo } : undefined,
      });
      if (!left) {
        this.#finished = false;
      }
    } catch (error) {
      this.#submitError.set(toApiError(error));
      this.#serverErrors.set(this.#errors.fieldErrors(error));
      if (this.submitOffline()) {
        this.#toast.warning('offline.needsConnection');
      }
      this.#focusFirstInvalid();
    } finally {
      this.#saving.set(false);
    }
  }

  /**
   * Sede the previous screen named. The query is the durable copy (it survives a reload);
   * navigation state covers a link that has not been given a query yet.
   */
  #requestedSede(): string | undefined {
    const fromQuery = this.sede()?.trim();
    if (fromQuery) {
      return fromQuery;
    }
    const state = this.#location.getState() as { readonly sede?: unknown } | null | undefined;
    return typeof state?.sede === 'string' && state.sede.length > 0 ? state.sede : undefined;
  }

  /**
   * A return control exists only when navigation state names a path this app allows.
   * A reload keeps `history.state`; a typed or bookmarked URL does not, so the button stays hidden.
   */
  #syncReturn(): void {
    const destination = readReturnTo(this.#location.getState());
    if (!destination) {
      this.returnTo.set(null);
      return;
    }
    const current = this.#router.url.split(/[?#]/)[0] ?? '';
    this.returnTo.set(destination === current ? null : destination);
  }

  /**
   * The sede the alta is stored against: the one the person named, or the only open one.
   * A shared-scope event still charges the sede they chose; it does not fall back to
   * whichever participation the catalogue listed first.
   */
  #defaultSede(event: PublicEvent): PublicParticipation | undefined {
    return registrationSede(event, this.#requestedSede());
  }

  /** True when leaving would drop something the person already typed. */
  #hasDraft(): boolean {
    const value = this.form.getRawValue();
    return (
      value.documentNumber.trim().length > 0 ||
      value.fullName.trim().length > 0 ||
      value.email.trim().length > 0 ||
      value.phone.trim().length > 0 ||
      value.requiresElectronicInvoice !== null ||
      value.address.trim().length > 0 ||
      value.carrier.trim().length > 0 ||
      value.deliveryCityId.trim().length > 0 ||
      value.companions.length > 0
    );
  }

  /**
   * Maps a field path coming from the server (`documentNumber`, `companions.1.email`) to the
   * input that paints its message. Paths with no input of their own (`participationId`,
   * `companions`) return `undefined`: the alert above the button is their place.
   */
  #anchorFor(path: string): InvalidField | undefined {
    const companion = COMPANION_PATH.exec(path);
    if (companion) {
      const suffix = COMPANION_PATH_SUFFIX.get(companion[2] ?? '');
      if (!suffix) {
        return undefined;
      }
      const index = Number(companion[1]);
      return {
        anchor: `comp${index}${suffix}`,
        labelKey: 'register.companions.item',
        labelParams: { index: index + 1 },
      };
    }

    const titular: { readonly anchor: string; readonly labelKey: MessageKey } | undefined =
      TITULAR_SUMMARY[path as keyof typeof TITULAR_SUMMARY];
    return titular ? { ...titular } : undefined;
  }

  /**
   * A failed submit must not leave the user at the bottom of the page wondering which
   * field to fix: the first rejected control takes the focus.
   */
  #focusFirstInvalid(): void {
    const host = this.formRef()?.nativeElement;
    const invalid =
      host?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      host?.querySelector<HTMLElement>('.field.ng-invalid');
    invalid?.focus();
  }

  #buildRequest(participation: PublicParticipation): CreateRegistrationRequest {
    const value = this.form.getRawValue();
    const companions = companionRequests(this.form.controls.companions);

    return {
      participationId: participation.id,
      documentType: value.documentType,
      documentNumber: value.documentNumber.trim(),
      fullName: value.fullName.trim(),
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      requiresElectronicInvoice: value.requiresElectronicInvoice === true,
      ...(this.asksDelivery()
        ? {
            deliveryMode: value.deliveryMode === 'other' || !this.venueCityId() ? 'other' : 'venue',
            address: value.address.trim(),
            carrier: value.deliveryMode === 'other' || !this.venueCityId() ? value.carrier.trim() : null,
            deliveryCityId:
              value.deliveryMode === 'other' || !this.venueCityId() ? value.deliveryCityId : null,
          }
        : {}),
      companions,
    };
  }

  /**
   * Everything the receipt screen cannot ask the API for: the alta only returns the code,
   * the titular and the count, so names and schedule travel with the stored copy.
   */
  #receiptContext(
    event: PublicEvent,
    participation: PublicParticipation,
    companionsCount: number,
  ): ReceiptContext {
    const value = this.form.getRawValue();
    const companionNames = this.form.controls.companions.controls
      .map((companion) => companion.controls.fullName.value.trim())
      .filter((name) => name.length > 0)
      .slice(0, companionsCount);

    const shared = event.registrationScope === 'all_venues';
    return {
      eventSlug: event.slug,
      eventName: event.name,
      eventTimeZone: event.timezone,
      eventStartsAt: event.startsAt,
      establishmentName: shared ? '' : participation.establishment.name,
      establishmentCity: shared ? null : participation.establishment.city,
      registrationScope: event.registrationScope ?? 'per_venue',
      companionNames,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      ticketDesign: event.ticketDesign ?? null,
    };
  }
}
