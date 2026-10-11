import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import { ToastService, type ToastTone } from '@core/ui/toast.service';
import { Icon } from '../icon/icon';

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'border-[var(--border-strong)]',
  success: 'border-[var(--success)]',
  warning: 'border-[var(--warning)]',
  danger: 'border-[var(--danger)]',
};

const TONE_CHIP: Record<ToastTone, string> = {
  info: 'chip',
  success: 'chip chip--success',
  warning: 'chip chip--warning',
  danger: 'chip chip--danger',
};

const TONE_LABEL: Record<ToastTone, string> = {
  info: 'app.loading',
  success: 'toast.saved',
  warning: 'app.offline',
  danger: 'app.error.title',
};

/**
 * Global toast region. Failures are `role="alert"` (assertive) and stay on screen
 * until dismissed; everything else is polite and auto-expires.
 */
@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe, Icon],
  templateUrl: './toast-host.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService).toasts;
  protected readonly service = inject(ToastService);
  protected readonly toneClass = TONE_CLASS;
  protected readonly toneChip = TONE_CHIP;
  protected readonly toneLabel = TONE_LABEL;
}
