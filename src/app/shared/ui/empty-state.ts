import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n';
import { Icon, type IconName } from './icon/icon';

/** Neutral placeholder for "nothing here yet", empty filters and error-free 404s. */
@Component({
  selector: 'app-empty-state',
  imports: [TranslatePipe, Icon],
  templateUrl: './empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly titleKey = input.required<MessageKey>();
  readonly bodyKey = input<MessageKey | undefined>(undefined);
  /** Glyph shown above the title; stays decorative and monochrome. */
  readonly iconName = input<IconName>('inbox');
}
