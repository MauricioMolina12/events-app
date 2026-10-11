import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n';
import { Icon } from './icon/icon';

/** Page title block used by every route component. */
@Component({
  selector: 'app-page-header',
  imports: [TranslatePipe, Icon],
  templateUrl: './page-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly titleKey = input.required<MessageKey>();
  readonly subtitleKey = input<MessageKey | undefined>(undefined);
  readonly backLink = input<string | undefined>(undefined);
  readonly backLabelKey = input<MessageKey>('app.back');
}
