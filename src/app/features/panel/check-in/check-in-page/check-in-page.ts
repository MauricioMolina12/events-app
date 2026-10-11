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
import { formatDocument } from '@core/utils/documents';
import { ButtonDirective, Icon, PageHeader } from '@shared/ui';
import { CheckInApi, type CheckInResult } from '../check-in.api';
import { announceCheckIn } from '../check-in-events';
import { ScannerError, startQrScanner, type QrScanner, type ScannerFailure } from '../qr-scanner';

type Phase = 'idle' | 'starting' | 'scanning' | 'processing' | 'result' | 'error';

const TIME_FORMAT = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

/**
 * Door check-in: the staff scans the receipt QR and the server hands out one consecutive
 * turn per person (titular first, then the companions). After a read the camera stops and
 * the turns take the whole screen, so the number is what the staff reads out loud.
 */
@Component({
  selector: 'app-check-in-page',
  imports: [TranslatePipe, ReactiveFormsModule, ButtonDirective, Icon, PageHeader],
  templateUrl: './check-in-page.html',
  styleUrl: './check-in-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInPage {
  readonly #api = inject(CheckInApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);

  protected readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  protected readonly manualInput = viewChild<ElementRef<HTMLInputElement>>('manualInput');

  protected readonly phase = signal<Phase>('idle');
  protected readonly cameraFailure = signal<ScannerFailure | null>(null);
  protected readonly result = signal<CheckInResult | null>(null);
  protected readonly errorMessage = signal('');

  protected readonly manualForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly cameraOn = computed(
    () => this.phase() === 'starting' || this.phase() === 'scanning',
  );
  protected readonly showScanner = computed(
    () => this.phase() !== 'result' && this.phase() !== 'error',
  );
  protected readonly assignedTime = computed(() => {
    const result = this.result();
    return result ? TIME_FORMAT.format(new Date(result.assignedAt)) : '';
  });
  protected readonly holderDocument = computed(() => {
    const registration = this.result()?.registration;
    return registration
      ? `${registration.documentType} ${formatDocument(registration.documentNumber, registration.documentType)}`
      : '';
  });

  #scanner: QrScanner | null = null;
  #request: Subscription | null = null;

  constructor() {
    afterNextRender(() => void this.startCamera());
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
    if (this.phase() === 'processing') {
      return;
    }
    this.#stopCamera();
    this.phase.set('processing');
    this.#request?.unsubscribe();
    this.#request = this.#api.scan(code).subscribe({
      next: (result) => {
        this.result.set(result);
        this.phase.set('result');
        if (!result.alreadyAssigned) {
          announceCheckIn(result.event.id);
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

  protected scanNext(): void {
    this.result.set(null);
    this.errorMessage.set('');
    this.manualForm.reset();
    this.phase.set('idle');
    if (this.cameraFailure()) {
      this.manualInput()?.nativeElement.focus();
    } else {
      void this.startCamera();
    }
  }

  protected roleLabel(role: 'holder' | 'companion'): string {
    return this.#i18n.t(role === 'holder' ? 'checkIn.result.holder' : 'checkIn.result.companion');
  }

  #stopCamera(): void {
    this.#scanner?.stop();
    this.#scanner = null;
  }
}
