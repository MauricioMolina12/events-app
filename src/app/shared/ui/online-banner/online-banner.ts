import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import { NetworkStatusService } from '@core/ui/network-status.service';

/** Slim, non-blocking notice shown while the browser reports no connectivity. */
@Component({
  selector: 'app-online-banner',
  imports: [TranslatePipe],
  templateUrl: './online-banner.html',
  host: {
    class:
      'fixed inset-x-0 top-0 z-50 flex justify-center p-2 transition-opacity pointer-events-none',
    '[class.opacity-0]': '!network.offline()',
    '[class.pointer-events-none]': 'true',
    '[attr.aria-hidden]': '!network.offline()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineBanner {
  protected readonly network = inject(NetworkStatusService);
}
