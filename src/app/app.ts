import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NetworkStatusService } from '@core/ui/network-status.service';
import { OnlineBanner } from '@shared/ui/online-banner/online-banner';
import { ToastHost } from '@shared/ui/toast-host/toast-host';

/**
 * Root shell. It owns nothing but the truly global chrome: the toast region and the
 * offline banner, so they survive every route change.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, OnlineBanner],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly network = inject(NetworkStatusService);
}
