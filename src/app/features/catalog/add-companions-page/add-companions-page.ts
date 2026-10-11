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
import { Location } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, map, switchMap, type Observable } from 'rxjs';
import { toApiError, type ApiError } from '@core/api';
import type {
  HolderCredentials,
  PublicEvent,
  PublicHolderRegistration,
  PublicParticipation,
} from '@core/domain';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter, ToastService } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { toZonedDateTimeDisplay } from '@core/utils/dates';
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  formatDocument,
  type DocumentType,
} from '@core/utils/documents';
import {
  ButtonDirective,
  EmptyState,
  FieldControlDirective,
  FormField,
  Icon,
  Skeleton,
} from '@shared/ui';
import { CATALOG_MAX_PAGE_SIZE, CatalogApi } from '../catalog.api';
import {
  companionGroup,
  companionRequests,
  documentValidator,
  validationMessage,
  type CompanionForm,
} from '../companion-form';
import { companionReason } from '../participation-availability';
import { ReceiptStore } from '../receipt.store';

interface FlowStep {
  readonly index: number;
  readonly labelKey: MessageKey;
}

const FLOW_STEPS: readonly FlowStep[] = [
  { index: 1, labelKey: 'companions.step.lookup' },
  { index: 2, labelKey: 'companions.step.add' },
  { index: 3, labelKey: 'companions.step.receipt' },
];

const SKELETON_ROWS: readonly number[] = [1, 2];

/** What the receipt hands over (navigation state, never the URL) to skip retyping. */
interface PrefillState {
  readonly documentType?: DocumentType;
  readonly documentNumber?: string;
  readonly email?: string;
}

/**
 * "Agregar acompañante" (`/eventos/:slug/acompanantes` and `/acompanantes`).
 *
 * Someone who already registered as titular adds the people who join later, without a second
 * alta. There is no account: the titular proves the alta is theirs with the event, the
 * document and the email they used. The server answers a mismatch with a plain 404, so the
 * screen cannot be used to find out who is registered.
 *
 * The cap of companions per titular counts the ones already in the alta, so the form only
 * offers the rows that are left (and never more than the sede can still seat). The server
 * re-checks both on submit.
 */
@Component({
  selector: 'app-add-companions-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ReactiveFormsModule,
    ButtonDirective,
    EmptyState,
    FieldControlDirective,
    FormField,
    Icon,
    Skeleton,
  ],
  templateUrl: './add-companions-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCompanionsPage {
  /** Route parameter of `/eventos/:slug/acompanantes`; absent on `/acompanantes`. */
  readonly slug = input<string | undefined>(undefined);
  /** `?evento=` presets the picker on `/acompanantes`. */
  readonly evento = input<string | undefined>(undefined);

  readonly #api = inject(CatalogApi);
  readonly #router = inject(Router);
  readonly #location = inject(Location);
  readonly #receipts = inject(ReceiptStore);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #toast = inject(ToastService);
  readonly #i18n = inject(I18nService);

  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ slug: this.slug(), attempt: this.#attempt() }));

  /** The event of the path alone, or every published event for the picker. */
  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ slug }) => this.#load(slug).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<readonly PublicEvent[]>() },
  );

  protected readonly steps = FLOW_STEPS;
  protected readonly placeholders = SKELETON_ROWS;
  protected readonly documentTypes = DOCUMENT_TYPES;

  readonly #searching = signal(false);
  readonly #saving = signal(false);
  readonly #lookupSubmitted = signal(false);
  readonly #addSubmitted = signal(false);
  readonly #lookupError = signal<ApiError | null>(null);
  readonly #submitError = signal<ApiError | null>(null);
  readonly #serverErrors = signal<Record<string, string>>({});
  readonly #holder = signal<PublicHolderRegistration | null>(null);
  /** Exactly what the lookup matched, so the append cannot drift from the shown titular. */
  readonly #credentials = signal<HolderCredentials | null>(null);
  readonly #companionCount = signal(0);
  #prefilled = false;

  protected readonly lookupForm = new FormGroup({
    event: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    documentType: new FormControl<DocumentType>('CC', { nonNullable: true }),
    documentNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, documentValidator],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly addForm = new FormGroup({ companions: new FormArray<CompanionForm>([]) });
  protected readonly companions = this.addForm.controls.companions;

  protected readonly lookupRef = viewChild<ElementRef<HTMLFormElement>>('lookupFormRef');
  protected readonly addRef = viewChild<ElementRef<HTMLFormElement>>('addFormRef');

  protected readonly searching = this.#searching.asReadonly();
  protected readonly saving = this.#saving.asReadonly();
  protected readonly holder = this.#holder.asReadonly();

  readonly #events = computed<readonly PublicEvent[]>(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : [];
  });

  /** The path names the event: the picker is replaced by its name. */
  protected readonly fixedEvent = computed(() => (this.slug() ? (this.#events()[0] ?? null) : null));

  protected readonly events = this.#events;

  /** Event the found alta belongs to; the lookup accepts slug or id, so both are matched. */
  protected readonly holderEvent = computed(() => {
    const event = this.#credentials()?.event;
    return this.#events().find((item) => item.slug === event || item.id === event) ?? null;
  });

  protected readonly participation = computed<PublicParticipation | null>(() => {
    const holder = this.#holder();
    return (
      this.holderEvent()?.participations.find((item) => item.id === holder?.participationId) ??
      null
    );
  });

  protected readonly remaining = computed(() => {
    const holder = this.#holder();
    return holder ? Math.max(0, holder.maxCompanions - holder.companionsCount) : 0;
  });

  /** `undefined` while the sede can still seat companions. */
  protected readonly blockedReason = computed<MessageKey | undefined>(() => {
    const participation = this.participation();
    return participation ? companionReason(participation) : undefined;
  });

  /** Rows the form may hold: what is left of the cap, never more than the sede can seat. */
  protected readonly maxRows = computed(() => {
    const participation = this.participation();
    const seats = participation ? Math.max(0, participation.availableCompanions) : this.remaining();
    return Math.min(this.remaining(), seats);
  });

  protected readonly canAddRow = computed(() => this.#companionCount() < this.maxRows());

  protected readonly canSubmit = computed(
    () =>
      this.remaining() > 0 && this.blockedReason() === undefined && this.#companionCount() > 0,
  );

  protected readonly currentStep = computed(() => (this.#holder() ? 2 : 1));

  protected readonly holderDocument = computed(() => {
    const holder = this.#holder();
    return holder ? formatDocument(holder.documentNumber, holder.documentType) : '';
  });

  protected readonly whenLabel = computed(() => {
    const event = this.holderEvent() ?? this.fixedEvent();
    return event?.startsAt ? toZonedDateTimeDisplay(event.startsAt, event.timezone) : '';
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

  protected readonly isMissing = computed(() => {
    const error = this.error();
    return error ? this.#errors.isNotFound(error) : false;
  });

  /** A not-found lookup gets its own wording: the generic one reads like a broken link. */
  protected readonly lookupMessage = computed(() => {
    const error = this.#lookupError();
    if (!error) {
      return '';
    }
    return error.code === 'REGISTRATION_NOT_FOUND'
      ? this.#i18n.t('companions.lookup.notFound')
      : this.#errors.message(error);
  });

  protected readonly submitMessage = computed(() => {
    const error = this.#submitError();
    return error ? this.#errors.message(error) : '';
  });

  protected readonly submitSupportCode = computed(() => {
    const error = this.#submitError();
    return error ? (this.#errors.supportCode(error) ?? '') : '';
  });

  constructor() {
    effect(() => {
      const events = this.#events();
      if (this.#prefilled || events.length === 0) {
        return;
      }
      this.#prefilled = true;
      const wanted = this.slug() ?? this.evento();
      const event =
        events.find((item) => item.slug === wanted || item.id === wanted) ??
        (events.length === 1 ? events[0] : undefined);
      const prefill = this.#prefill();
      this.lookupForm.patchValue({
        event: event?.slug ?? '',
        ...(prefill.documentType ? { documentType: prefill.documentType } : {}),
        ...(prefill.documentNumber ? { documentNumber: prefill.documentNumber } : {}),
        ...(prefill.email ? { email: prefill.email } : {}),
      });
    });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  protected stepState(index: number): 'done' | 'current' | 'pending' {
    const current = this.currentStep();
    if (index < current) {
      return 'done';
    }
    return index === current ? 'current' : 'pending';
  }

  protected documentLabel(type: DocumentType): string {
    return documentTypeLabel(type);
  }

  protected lookupError(control: AbstractControl, path: string): string | undefined {
    const server = this.#serverErrors()[path];
    if (server && !this.#holder()) {
      return server;
    }
    if (!control.touched && !this.#lookupSubmitted()) {
      return undefined;
    }
    return validationMessage(control, this.#i18n);
  }

  protected companionError(control: AbstractControl, path: string): string | undefined {
    const server = this.#serverErrors()[path];
    if (server && this.#holder()) {
      return server;
    }
    if (!control.touched && !this.#addSubmitted()) {
      return undefined;
    }
    return validationMessage(control, this.#i18n);
  }

  protected async lookup(): Promise<void> {
    this.#lookupSubmitted.set(true);
    if (this.#searching()) {
      return;
    }
    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      this.#focusFirstInvalid(this.lookupRef()?.nativeElement);
      return;
    }

    const value = this.lookupForm.getRawValue();
    const credentials: HolderCredentials = {
      event: value.event,
      documentType: value.documentType,
      documentNumber: value.documentNumber.trim(),
      email: value.email.trim(),
    };

    this.#searching.set(true);
    this.#lookupError.set(null);
    this.#serverErrors.set({});
    try {
      const holder = await firstValueFrom(this.#api.lookupHolderRegistration(credentials));
      this.#credentials.set(credentials);
      this.#showHolder(holder);
    } catch (error) {
      this.#lookupError.set(toApiError(error));
      this.#serverErrors.set(this.#errors.fieldErrors(error));
      this.#focusFirstInvalid(this.lookupRef()?.nativeElement);
    } finally {
      this.#searching.set(false);
    }
  }

  /** Back to step 1 keeping what was typed, in case a digit was wrong. */
  protected changeHolder(): void {
    this.#holder.set(null);
    this.#credentials.set(null);
    this.#submitError.set(null);
    this.#serverErrors.set({});
    this.#addSubmitted.set(false);
    this.companions.clear();
    this.#companionCount.set(0);
  }

  protected addRow(): void {
    if (!this.canAddRow()) {
      return;
    }
    this.companions.push(companionGroup());
    this.#companionCount.set(this.companions.length);
  }

  protected removeRow(index: number): void {
    this.companions.removeAt(index);
    this.#companionCount.set(this.companions.length);
  }

  protected async submit(): Promise<void> {
    this.#addSubmitted.set(true);
    const holder = this.#holder();
    const credentials = this.#credentials();
    if (!holder || !credentials || this.#saving() || !this.canSubmit()) {
      return;
    }
    if (this.companions.invalid) {
      this.companions.markAllAsTouched();
      this.#focusFirstInvalid(this.addRef()?.nativeElement);
      return;
    }
    const companions = companionRequests(this.companions);
    if (companions.length === 0) {
      return;
    }

    this.#saving.set(true);
    this.#submitError.set(null);
    this.#serverErrors.set({});
    try {
      const updated = await firstValueFrom(
        this.#api.addCompanions({ ...credentials, companions }),
      );
      this.#updateStoredReceipt(updated, companions.map((companion) => companion.fullName));
      this.#toast.success('companions.success');
      await this.#router.navigate(['/inscripcion', updated.id]);
    } catch (error) {
      const apiError = toApiError(error);
      this.#submitError.set(apiError);
      this.#serverErrors.set(this.#errors.fieldErrors(error));
      if (apiError.code === 'COMPANION_LIMIT_REACHED') {
        void this.#refreshHolder(credentials);
      }
      this.#focusFirstInvalid(this.addRef()?.nativeElement);
    } finally {
      this.#saving.set(false);
    }
  }

  #showHolder(holder: PublicHolderRegistration): void {
    this.#holder.set(holder);
    this.#addSubmitted.set(false);
    this.companions.clear();
    this.#companionCount.set(0);
    if (this.maxRows() > 0 && this.blockedReason() === undefined) {
      this.addRow();
    }
  }

  /** Someone else filled the cap meanwhile: the counts on screen must catch up. */
  async #refreshHolder(credentials: HolderCredentials): Promise<void> {
    try {
      const holder = await firstValueFrom(this.#api.lookupHolderRegistration(credentials));
      this.#holder.set(holder);
      while (this.companions.length > this.maxRows()) {
        this.companions.removeAt(this.companions.length - 1);
      }
      this.#companionCount.set(this.companions.length);
    } catch {
      // The error already on screen stays the one the person has to act on.
    }
  }

  /** The device that made the alta keeps names and count in sync with the server. */
  #updateStoredReceipt(updated: PublicHolderRegistration, names: readonly string[]): void {
    const stored = this.#receipts.find(updated.id);
    if (!stored) {
      return;
    }
    this.#receipts.save({
      receipt: { ...stored.receipt, companionsCount: updated.companionsCount },
      context: {
        ...stored.context,
        companionNames: [...stored.context.companionNames, ...names].slice(
          0,
          updated.companionsCount,
        ),
      },
    });
  }

  #prefill(): PrefillState {
    return (this.#location.getState() as PrefillState | null | undefined) ?? {};
  }

  #focusFirstInvalid(host: HTMLElement | undefined): void {
    const invalid =
      host?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      host?.querySelector<HTMLElement>('.field.ng-invalid');
    invalid?.focus();
  }

  #load(slug: string | undefined): Observable<readonly PublicEvent[]> {
    if (slug) {
      return this.#api.getEvent(slug).pipe(map((event): readonly PublicEvent[] => [event]));
    }
    return this.#api.listEvents({ limit: CATALOG_MAX_PAGE_SIZE }).pipe(map((page) => page.items));
  }
}
