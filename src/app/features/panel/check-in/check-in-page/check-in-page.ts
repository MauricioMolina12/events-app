import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Subscription } from 'rxjs';
import { I18nService, TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { formatDocument } from '@core/utils/documents';
import { ButtonDirective, Icon, PageHeader, Select, type SelectChoice } from '@shared/ui';
import type { Event } from '@core/domain';
import type { Page } from '@core/api';
import { toSignal } from '@angular/core/rxjs-interop';
import { EventsApi } from '../../events/events.api';
import { RegistrationDeskApi, type DeskRow } from '../../registration-desk/registration-desk.api';
import {
  CheckInApi,
  type CheckInCompanion,
  type CheckInPreview,
  type CheckInResult,
} from '../check-in.api';
import { announceCheckIn } from '../check-in-events';
import { ScannerError, startQrScanner, type QrScanner, type ScannerFailure } from '../qr-scanner';

type Phase = 'idle' | 'starting' | 'scanning' | 'processing' | 'confirm' | 'result' | 'error';
type ConfirmStep = 'holder' | 'companions' | 'late';
type ProcessingKind = 'lookup' | 'confirm';

const TIME_FORMAT = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

/**
 * Door check-in: the staff scans the receipt QR, confirms the titular is present
 * and which companions arrived, then the server hands out consecutive turns.
 * Companions who did not come free their slot.
 */
@Component({
  selector: 'app-check-in-page',
  imports: [TranslatePipe, ReactiveFormsModule, ButtonDirective, Icon, PageHeader, Select],
  templateUrl: './check-in-page.html',
  styleUrl: './check-in-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInPage {
  readonly #api = inject(CheckInApi);
  readonly #desk = inject(RegistrationDeskApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);

  protected readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  protected readonly manualInput = viewChild<ElementRef<HTMLInputElement>>('manualInput');

  protected readonly phase = signal<Phase>('idle');
  protected readonly processingKind = signal<ProcessingKind>('lookup');
  protected readonly confirmStep = signal<ConfirmStep>('holder');
  protected readonly cameraFailure = signal<ScannerFailure | null>(null);
  protected readonly preview = signal<CheckInPreview | null>(null);
  protected readonly result = signal<CheckInResult | null>(null);
  protected readonly presentCompanionIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingCode = signal('');
  protected readonly errorMessage = signal('');
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<readonly CheckInPreview[]>([]);
  protected readonly searching = signal(false);
  protected readonly recent = signal<readonly DeskRow[]>([]);
  protected readonly eventId = signal('');

  protected readonly events = toSignal(
    inject(EventsApi).list({ limit: 100 }).pipe(toAsyncState()),
    { initialValue: loadingState<Page<Event>>() },
  );
  protected readonly eventChoices = computed<readonly SelectChoice[]>(() => {
    const state = this.events();
    if (state.status !== 'loaded') {
      return [];
    }
    return state.value.items.map((event) => ({ value: event.id, label: event.name }));
  });

  protected readonly pendingCompanions = computed(() =>
    (this.preview()?.companions ?? []).filter((companion) => !companion.checkedIn),
  );

  protected readonly manualForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly cameraOn = computed(
    () => this.phase() === 'starting' || this.phase() === 'scanning',
  );
  protected readonly showScanner = computed(
    () => this.phase() !== 'confirm' && this.phase() !== 'result' && this.phase() !== 'error',
  );
  protected readonly assignedTime = computed(() => {
    const result = this.result();
    return result ? TIME_FORMAT.format(new Date(result.assignedAt)) : '';
  });
  protected readonly ticket = computed(() => this.preview() ?? this.result());
  protected readonly holderDocument = computed(() => {
    const registration = this.ticket()?.registration;
    return registration
      ? `${registration.documentType} ${formatDocument(registration.documentNumber, registration.documentType)}`
      : '';
  });
  protected readonly releasedCount = computed(() => {
    const companions = this.preview()?.companions ?? [];
    return Math.max(0, companions.length - this.presentCompanionIds().size);
  });

  #scanner: QrScanner | null = null;
  #request: Subscription | null = null;

  constructor() {
    afterNextRender(() => {
      void this.startCamera();
      const first = this.eventChoices()[0]?.value;
      if (first && !this.eventId()) {
        this.eventId.set(first);
      }
      this.loadRecent();
    });
    inject(DestroyRef).onDestroy(() => {
      this.#stopCamera();
      this.#request?.unsubscribe();
    });
  }

  protected async startCamera(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video || this.cameraOn()) {
      return;
    }
    this.cameraFailure.set(null);
    this.phase.set('starting');
    try {
      this.#scanner = await startQrScanner(video, (code) => this.submitCode(code));
      if (this.phase() === 'starting') {
        this.phase.set('scanning');
      } else {
        this.#stopCamera();
      }
    } catch (error) {
      this.#scanner = null;
      this.cameraFailure.set(error instanceof ScannerError ? error.reason : 'unavailable');
      if (this.phase() === 'starting') {
        this.phase.set('idle');
      }
    }
  }

  protected stopCamera(): void {
    this.#stopCamera();
    this.phase.set('idle');
  }

  protected submitManual(): void {
    const code = this.manualForm.controls.code.value.trim();
    if (code) {
      this.submitCode(code);
    }
  }

  protected submitCode(code: string): void {
    const normalized = code.trim();
    if (this.phase() === 'processing' || !normalized) {
      return;
    }
    this.#stopCamera();
    this.processingKind.set('lookup');
    this.phase.set('processing');
    this.pendingCode.set(normalized);
    this.#request?.unsubscribe();
    this.#request = this.#api.lookup(normalized).subscribe({
      next: (preview) => {
        this.preview.set(preview);
        this.#openPreview(preview);
        this.presentCompanionIds.set(new Set(preview.companions.map((companion) => companion.id)));
        this.confirmStep.set('holder');
        this.phase.set('confirm');
      },
      error: (error: unknown) => {
        this.errorMessage.set(this.#errors.message(error));
        this.phase.set('error');
        navigator.vibrate?.([200]);
      },
    });
  }

  protected confirmHolderPresent(): void {
    const preview = this.preview();
    if (!preview) {
      return;
    }
    if (preview.companions.length === 0) {
      this.#confirmAttendance();
      return;
    }
    this.confirmStep.set('companions');
  }

  protected confirmHolderAbsent(): void {
    this.errorMessage.set(this.#i18n.t('checkIn.error.holderAbsent'));
    this.phase.set('error');
  }

  protected backToHolder(): void {
    this.confirmStep.set('holder');
  }

  protected toggleCompanion(id: string): void {
    const next = new Set(this.presentCompanionIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.presentCompanionIds.set(next);
  }

  protected companionPresent(id: string): boolean {
    return this.presentCompanionIds().has(id);
  }

  protected companionDocument(companion: CheckInCompanion): string {
    if (!companion.documentType || !companion.documentNumber) {
      return '';
    }
    return `${companion.documentType} ${formatDocument(companion.documentNumber, companion.documentType)}`;
  }

  protected confirmCompanions(): void {
    this.#confirmAttendance();
  }

  protected confirmLateCompanions(): void {
    this.#confirmAttendance();
  }

  protected searchPerson(): void {
    const query = this.searchQuery().trim();
    const eventId = this.eventId() || this.eventChoices()[0]?.value;
    if (!query || !eventId || this.searching()) {
      return;
    }
    this.eventId.set(eventId);
    this.searching.set(true);
    this.#api.search(eventId, query).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.searching.set(false);
        if (results.length === 1 && results[0]) {
          this.#openPreview(results[0]);
        }
      },
      error: (error: unknown) => {
        this.searching.set(false);
        this.errorMessage.set(this.#errors.message(error));
        this.phase.set('error');
      },
    });
  }

  protected pickSearchResult(preview: CheckInPreview): void {
    this.#openPreview(preview);
  }

  protected loadRecent(): void {
    const eventId = this.eventId() || this.eventChoices()[0]?.value;
    if (!eventId) {
      return;
    }
    this.#desk
      .registrations({ eventId, checkIn: 'checked_in', sort: 'checkedInAt', order: 'desc', limit: 8 })
      .subscribe({
        next: (page) => this.recent.set(page.items),
        error: () => this.recent.set([]),
      });
  }

  #openPreview(preview: CheckInPreview): void {
    this.preview.set(preview);
    this.pendingCode.set(preview.registration.id);
    const pending = preview.companions.filter((companion) => !companion.checkedIn);
    if (preview.alreadyAssigned && pending.length === 0) {
      this.result.set({ ...preview, releasedCompanionsCount: 0 });
      this.phase.set('result');
      navigator.vibrate?.([60, 60, 60]);
      return;
    }
    if (preview.alreadyAssigned) {
      this.presentCompanionIds.set(new Set());
      this.confirmStep.set('late');
      this.phase.set('confirm');
      return;
    }
    this.presentCompanionIds.set(new Set(preview.companions.map((companion) => companion.id)));
    this.confirmStep.set('holder');
    this.phase.set('confirm');
  }

  protected scanNext(): void {
    this.preview.set(null);
    this.result.set(null);
    this.errorMessage.set('');
    this.pendingCode.set('');
    this.confirmStep.set('holder');
    this.presentCompanionIds.set(new Set());
    this.manualForm.reset();
    this.phase.set('idle');
    if (this.cameraFailure()) {
      this.manualInput()?.nativeElement.focus();
    } else {
      void this.startCamera();
    }
  }

  protected recentTime(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('es-CO') : '';
  }

  protected roleLabel(role: 'holder' | 'companion'): string {
    return this.#i18n.t(role === 'holder' ? 'checkIn.result.holder' : 'checkIn.result.companion');
  }

  #confirmAttendance(): void {
    const code = this.pendingCode();
    if (!code || this.phase() === 'processing') {
      return;
    }
    this.processingKind.set('confirm');
    this.phase.set('processing');
    this.#request?.unsubscribe();
    this.#request = this.#api
      .confirm(code, {
        holderPresent: true,
        presentCompanionIds: [...this.presentCompanionIds()],
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.phase.set('result');
          if (!result.alreadyAssigned) {
            announceCheckIn(result.event.id);
            this.loadRecent();
          }
          navigator.vibrate?.(result.alreadyAssigned ? [60, 60, 60] : 90);
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.#errors.message(error));
          this.phase.set('error');
          navigator.vibrate?.([200]);
        },
      });
  }

  #stopCamera(): void {
    this.#scanner?.stop();
    this.#scanner = null;
  }
}
