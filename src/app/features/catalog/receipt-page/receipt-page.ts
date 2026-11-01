import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { toApiError } from '@core/api';
import { I18nService, TranslatePipe, type MessageKey, type MessageParams } from '@core/i18n';
import { readReturnTo, safeEventSlug } from '@core/navigation/return-to';
import { ApiErrorPresenter, ToastService } from '@core/ui';
import {
  MAX_COMPANIONS_PER_REGISTRATION,
  type PublicEvent,
  type PublicRegistrationReceipt,
} from '@core/domain';
import { errorState, loadedState, loadingState, toAsyncState } from '@core/utils/async-state';
import { toZonedDateTimeDisplay } from '@core/utils/dates';
import { formatDocument } from '@core/utils/documents';
import {
  ButtonDirective,
  EmptyState,
  Icon,
  QrCode,
  Skeleton,
  StatusBadge,
  type StatusKind,
} from '@shared/ui';
import { DEFAULT_PRIMARY } from '@core/workspace/brand-color';
import { WorkspaceService } from '@core/workspace/workspace.service';
import { ticketVenueLabel } from '@shared/ticket/ticket-presentation';
import { CatalogApi } from '../catalog.api';
import { ReceiptStore } from '../receipt.store';

type CopyState = 'idle' | 'copying' | 'copied';

/**
 * Confirmation screen (`/inscripcion/:id`).
 *
 * The receipt is read from the folio lookup (`GET /public/registrations/{id}`), so a
 * reload, a shared link or a second device all land on the same confirmation instead of
 * a "not found". That payload has no event name, date or ticket design. Those come from
 * the public event named by `?evento=` (or by the slug this browser kept), so a later
 * consult uses the design the owner has saved now, not a snapshot from the alta.
 */
@Component({
  selector: 'app-receipt-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonDirective,
    EmptyState,
    Icon,
    QrCode,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './receipt-page.html',
  styleUrl: './receipt-page.css',
  host: { class: 'block min-w-0 w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiptPage {
  /** Route parameter: the registration id returned by the alta. */
  readonly id = input.required<string>();
  /**
   * `?evento=` is the public slug of the event this folio belongs to.
   * It survives a reload. A value that is not a slug is ignored.
   */
  readonly evento = input<string | undefined>(undefined);

  readonly #api = inject(CatalogApi);
  readonly #receipts = inject(ReceiptStore);
  readonly #toast = inject(ToastService);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #workspace = inject(WorkspaceService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #location = inject(Location);

  /** Bumped by `retry()`; part of the request so a retry re-subscribes. */
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({ id: this.id(), attempt: this.#attempt() }));
  readonly #copyState = signal<CopyState>('idle');
  #copyReset: ReturnType<typeof setTimeout> | undefined;

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ id }) => this.#api.getRegistration(id).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<PublicRegistrationReceipt>() },
  );

  protected readonly downloading = signal(false);

  protected readonly receipt = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });

  protected readonly context = computed(() => this.#receipts.find(this.id())?.context ?? null);

  /** Slug from the URL first, then the one this browser stored with the alta. */
  protected readonly eventSlug = computed(
    () => safeEventSlug(this.evento()) ?? safeEventSlug(this.context()?.eventSlug) ?? null,
  );

  readonly #eventAttempt = signal(0);
  readonly #eventRequest = computed(() => ({
    slug: this.eventSlug(),
    attempt: this.#eventAttempt(),
  }));

  /**
   * Live event: name, date, scope and the ticket design the owner has saved.
   * A failure stays on this signal so the receipt itself (the folio) still renders.
   */
  readonly eventState = toSignal(
    toObservable(this.#eventRequest).pipe(
      switchMap(({ slug }) => {
        if (!slug) {
          return of(loadedState<PublicEvent | null>(null));
        }
        return this.#api.getEvent(slug).pipe(
          map((event) => loadedState<PublicEvent | null>(event)),
          startWith(loadingState<PublicEvent | null>()),
          catchError((error: unknown) => of(errorState<PublicEvent | null>(toApiError(error)))),
        );
      }),
    ),
    { initialValue: loadingState<PublicEvent | null>() },
  );

  protected readonly liveEvent = computed(() => {
    const state = this.eventState();
    return state.status === 'loaded' ? state.value : null;
  });

  protected readonly eventPending = computed(
    () => Boolean(this.eventSlug()) && this.eventState().status === 'loading',
  );

  protected readonly eventFailed = computed(() => this.eventState().status === 'error');

  protected readonly error = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.error : null;
  });

  protected readonly errorMessage = computed(() =>
    this.error() ? this.#errors.message(this.error()) : '',
  );

  protected readonly isOffline = computed(() =>
    this.error() ? this.#errors.isOffline(this.error()) : false,
  );

  /** An id the server does not know is a missing registration, not a failure. */
  protected readonly isMissing = computed(() =>
    this.error() ? this.#errors.isNotFound(this.error()) : false,
  );

  protected readonly kind = computed<StatusKind>(() => {
    const status = this.receipt()?.status ?? 'confirmed';
    return `registration.${status}` as StatusKind;
  });

  protected readonly fullName = computed(() => this.receipt()?.fullName ?? '');
  protected readonly receiptId = computed(() => this.receipt()?.id ?? '');
  protected readonly otherVenues = computed(() => this.receipt()?.otherVenues ?? []);
  protected readonly otherVenueSlug = computed(
    () => this.eventSlug() ?? safeEventSlug(this.receipt()?.eventSlug) ?? null,
  );
  /**
   * Payload printed in the QR: the token issued at alta when this device kept it,
   * otherwise the folio so a shared link still shows a scannable code.
   */
  protected readonly qrValue = computed(
    () => this.#receipts.find(this.id())?.receipt.qrToken ?? this.receipt()?.id ?? '',
  );
  protected readonly qrVisible = computed(
    () => Boolean(this.qrValue()) && this.receipt()?.status !== 'cancelled',
  );
  protected readonly brandColor = computed(() => {
    const stored = this.#workspace.settings()?.primaryColor;
    if (stored) {
      return stored;
    }
    if (typeof document === 'undefined') {
      return DEFAULT_PRIMARY;
    }
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() ||
      DEFAULT_PRIMARY
    );
  });
  protected readonly document = computed(() => {
    const receipt = this.receipt();
    return receipt ? formatDocument(receipt.documentNumber, receipt.documentType) : '';
  });
  protected readonly companionsCount = computed(() => this.receipt()?.companionsCount ?? 0);
  protected readonly companionNames = computed(() => this.context()?.companionNames ?? []);
  /** Saved design when the event loaded; the device snapshot only if that read failed. */
  protected readonly ticketDesign = computed(() => {
    const state = this.eventState();
    if (state.status === 'loaded' && state.value) {
      return state.value.ticketDesign ?? null;
    }
    return this.context()?.ticketDesign ?? null;
  });

  protected readonly qrColor = computed(
    () => this.ticketDesign()?.accentColor ?? this.brandColor(),
  );

  protected readonly eventName = computed(() => {
    const live = this.liveEvent();
    if (live) {
      return live.name;
    }
    return this.context()?.eventName ?? null;
  });

  protected readonly when = computed(() => {
    const live = this.liveEvent();
    if (live?.startsAt) {
      return toZonedDateTimeDisplay(live.startsAt, live.timezone);
    }
    const context = this.context();
    return context?.eventStartsAt
      ? toZonedDateTimeDisplay(context.eventStartsAt, context.eventTimeZone)
      : '';
  });

  protected readonly venueLabel = computed(() => {
    const live = this.liveEvent();
    const scope = live?.registrationScope ?? this.context()?.registrationScope;
    const allVenuesLabel = this.#i18n.t('register.scope.allVenues');
    if (scope === 'all_venues') {
      return ticketVenueLabel({ scope, allVenuesLabel });
    }
    const participationId = this.receipt()?.participationId;
    const match = live?.participations.find((item) => item.id === participationId);
    if (match) {
      return ticketVenueLabel({
        scope,
        allVenuesLabel,
        establishmentName: match.establishment.name,
        establishmentCity: match.establishment.city,
      });
    }
    return ticketVenueLabel({
      scope,
      allVenuesLabel,
      establishmentName: this.context()?.establishmentName,
      establishmentCity: this.context()?.establishmentCity,
    });
  });

  protected readonly issuedAt = computed(() => {
    const receipt = this.receipt();
    if (!receipt) {
      return '';
    }
    const zone = this.liveEvent()?.timezone ?? this.context()?.eventTimeZone ?? 'UTC';
    return toZonedDateTimeDisplay(receipt.registeredAt, zone, {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  });
  protected readonly confirmationBody = computed(() => {
    const event = this.eventName();
    return event
      ? this.#i18n.t('register.confirmed.bodyWithEvent', { event })
      : this.#i18n.t('register.confirmed.body');
  });

  protected readonly howSteps: readonly MessageKey[] = [
    'register.receipt.how.1',
    'register.receipt.how.2',
    'register.receipt.how.3',
  ];

  protected readonly copyBusy = computed(() => this.#copyState() === 'copying');
  protected readonly copyLabel = computed<MessageKey>(() => {
    const state = this.#copyState();
    if (state === 'copying') {
      return 'register.receipt.copying';
    }
    if (state === 'copied') {
      return 'register.receipt.copied';
    }
    return 'register.receipt.copy';
  });

  /** Back link: the event it belongs to when known, else the catalogue. */
  protected readonly backLink = computed(() =>
    this.eventSlug() ? ['/eventos', this.eventSlug()] : ['/eventos'],
  );

  protected readonly backLabelKey = computed<MessageKey>(() =>
    this.eventSlug() ? 'register.back' : 'event.back',
  );

  /**
   * Only the desk hands over this destination, and only in navigation state.
   * A public visitor never sees a link into the panel.
   */
  protected readonly deskReturn = signal<string | null>(null);

  protected readonly canAddCompanion = computed(() => {
    const receipt = this.receipt();
    return (
      receipt?.status === 'confirmed' && receipt.companionsCount < MAX_COMPANIONS_PER_REGISTRATION
    );
  });

  protected readonly addCompanionLink = computed(() =>
    this.eventSlug() ? ['/eventos', this.eventSlug(), 'acompanantes'] : ['/acompanantes'],
  );

  /** Travels as navigation state so the document and email never land in the URL. */
  protected readonly addCompanionState = computed(() => {
    const receipt = this.receipt();
    return {
      documentType: receipt?.documentType,
      documentNumber: receipt?.documentNumber,
      email: this.email() ?? undefined,
    };
  });

  protected readonly email = computed(() => this.context()?.email ?? null);

  constructor() {
    const destination = readReturnTo(this.#location.getState());
    this.deskReturn.set(destination?.startsWith('/panel/mesa') ? destination : null);
    this.#destroyRef.onDestroy(() => {
      if (this.#copyReset !== undefined) {
        clearTimeout(this.#copyReset);
      }
    });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  /** Reloads the public event when the name, date or design failed to arrive. */
  protected retryEvent(): void {
    this.#eventAttempt.update((value) => value + 1);
  }

  /** Falls back to the raw value when the clipboard API is unavailable (http, no focus). */
  protected async copyCode(): Promise<void> {
    const code = this.receiptId();
    if (!code || this.#copyState() === 'copying') {
      return;
    }
    if (this.#copyReset !== undefined) {
      clearTimeout(this.#copyReset);
      this.#copyReset = undefined;
    }
    this.#copyState.set('copying');
    try {
      await navigator.clipboard.writeText(code);
      this.#copyState.set('copied');
      this.#copyReset = setTimeout(() => this.#copyState.set('idle'), 1800);
    } catch {
      this.#copyState.set('idle');
      this.#toast.warning('ui.copy.failed');
    }
  }

  /** The generator is loaded on demand: nobody pays for it until they ask for the PDF. */
  protected async downloadTicket(): Promise<void> {
    const receipt = this.receipt();
    if (!receipt || !this.qrVisible() || this.downloading() || this.eventPending()) {
      return;
    }
    this.downloading.set(true);
    try {
      const { downloadTicketPdf } = await import('./ticket-pdf');
      const sede = this.venueLabel();
      const design = this.ticketDesign();
      const t = (key: MessageKey, params?: MessageParams): string => this.#i18n.t(key, params);
      await downloadTicketPdf(
        {
          brand: t('app.name'),
          title: t('register.receipt.qr'),
          eventName: this.eventName(),
          when: this.when() || null,
          qrValue: this.qrValue(),
          qrCaption: t('register.receipt.how.1'),
          fields: [
            { label: t('register.receipt.titular'), value: receipt.fullName },
            { label: t('register.receipt.document'), value: this.document() },
            ...(sede ? [{ label: t('register.sede'), value: sede }] : []),
            { label: t('register.companions'), value: String(receipt.companionsCount) },
          ],
          folioLabel: t('register.receipt.folio'),
          folio: receipt.id,
          issued: `${t('register.receipt.issuedLabel')}: ${this.issuedAt()}`,
          footer: t('register.receipt.ticketFooter'),
          primaryColor: this.qrColor(),
          design: design ?? undefined,
        },
        `codigo-acceso-${receipt.id.slice(0, 8)}.pdf`,
      );
    } catch {
      this.#toast.warning('register.receipt.downloadFailed');
    } finally {
      this.downloading.set(false);
    }
  }

}
