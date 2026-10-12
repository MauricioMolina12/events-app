import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { I18nService, TranslatePipe, type MessageKey, type MessageParams } from '@core/i18n';
import { ApiErrorPresenter, ToastService } from '@core/ui';
import { MAX_COMPANIONS_PER_REGISTRATION, type PublicRegistrationReceipt } from '@core/domain';
import { loadingState, toAsyncState } from '@core/utils/async-state';
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
import { CatalogApi } from '../catalog.api';
import { ReceiptStore } from '../receipt.store';

type CopyState = 'idle' | 'copying' | 'copied';

/**
 * Confirmation screen (`/inscripcion/:id`).
 *
 * The receipt is read from the folio lookup (`GET /public/registrations/{id}`), so a
 * reload, a shared link or a second device all land on the same confirmation instead of
 * a "not found". The server answers with the receipt alone (titular, document, count);
 * the event/sede names, the schedule, the companions' names and the contact data are the
 * extra context this browser saved when the alta succeeded, merged in when present.
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

  readonly #api = inject(CatalogApi);
  readonly #receipts = inject(ReceiptStore);
  readonly #toast = inject(ToastService);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #workspace = inject(WorkspaceService);
  readonly #destroyRef = inject(DestroyRef);

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
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || DEFAULT_PRIMARY;
  });
  protected readonly document = computed(() => {
    const receipt = this.receipt();
    return receipt ? formatDocument(receipt.documentNumber, receipt.documentType) : '';
  });
  protected readonly companionsCount = computed(() => this.receipt()?.companionsCount ?? 0);
  protected readonly companionNames = computed(() => this.context()?.companionNames ?? []);
  protected readonly establishmentName = computed(() => this.context()?.establishmentName ?? null);
  protected readonly establishmentCity = computed(() => this.context()?.establishmentCity ?? null);
  protected readonly eventName = computed(() => this.context()?.eventName ?? null);
  protected readonly eventSlug = computed(() => this.context()?.eventSlug ?? null);
  protected readonly when = computed(() => {
    const context = this.context();
    return context?.eventStartsAt
      ? toZonedDateTimeDisplay(context.eventStartsAt, context.eventTimeZone)
      : '';
  });
  protected readonly issuedAt = computed(() => {
    const receipt = this.receipt();
    if (!receipt) {
      return '';
    }
    return toZonedDateTimeDisplay(receipt.registeredAt, this.context()?.eventTimeZone ?? 'UTC', {
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

  protected readonly canAddCompanion = computed(() => {
    const receipt = this.receipt();
    return (
      receipt?.status === 'confirmed' &&
      receipt.companionsCount < MAX_COMPANIONS_PER_REGISTRATION
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

  protected readonly phone = computed(() => this.context()?.phone ?? null);
  protected readonly email = computed(() => this.context()?.email ?? null);

  protected readonly whatsappHref = computed(() => {
    const digits = this.#phoneDigits();
    if (!digits) {
      return null;
    }
    return `https://wa.me/${digits}?text=${encodeURIComponent(this.#shareMessage())}`;
  });

  protected readonly mailtoHref = computed(() => {
    const email = this.email();
    if (!email) {
      return null;
    }
    const subject = encodeURIComponent(this.#i18n.t('register.confirmed.share.subject'));
    const body = encodeURIComponent(this.#shareMessage());
    return `mailto:${email}?subject=${subject}&body=${body}`;
  });

  constructor() {
    this.#destroyRef.onDestroy(() => {
      if (this.#copyReset !== undefined) {
        clearTimeout(this.#copyReset);
      }
    });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
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
    if (!receipt || !this.qrVisible() || this.downloading()) {
      return;
    }
    this.downloading.set(true);
    try {
      const { downloadTicketPdf } = await import('./ticket-pdf');
      const sede = this.establishmentName();
      const city = this.establishmentCity();
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
            ...(sede
              ? [{ label: t('register.sede'), value: city ? `${sede} · ${city}` : sede }]
              : []),
            { label: t('register.companions'), value: String(receipt.companionsCount) },
          ],
          folioLabel: t('register.receipt.folio'),
          folio: receipt.id,
          issued: `${t('register.receipt.issuedLabel')}: ${this.issuedAt()}`,
          footer: t('register.receipt.ticketFooter'),
          primaryColor: this.context()?.ticketDesign?.accentColor ?? this.brandColor(),
          design: this.context()?.ticketDesign ?? undefined,
        },
        `codigo-acceso-${receipt.id.slice(0, 8)}.pdf`,
      );
    } catch {
      this.#toast.warning('register.receipt.downloadFailed');
    } finally {
      this.downloading.set(false);
    }
  }

  /** WhatsApp needs digits only (country code included), so spaces and `+` are dropped. */
  #phoneDigits(): string | null {
    const phone = this.phone();
    if (!phone) {
      return null;
    }
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 ? digits : null;
  }

  #shareMessage(): string {
    const params: MessageParams = { name: this.fullName(), folio: this.receiptId() };
    const event = this.eventName();
    return event
      ? this.#i18n.t('register.confirmed.share.message', { ...params, event })
      : this.#i18n.t('register.confirmed.share.messageNoEvent', params);
  }
}
