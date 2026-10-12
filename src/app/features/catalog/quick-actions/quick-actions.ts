import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@core/i18n';
import { Icon } from '@shared/ui';

/**
 * The two public journeys side by side: a new alta, or companions for an alta that already
 * exists. The catalogue points at the generic gates; an event detail points at its own event.
 */
@Component({
  selector: 'app-quick-actions',
  imports: [TranslatePipe, RouterLink, Icon],
  templateUrl: './quick-actions.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickActions {
  readonly registerLink = input.required<readonly string[]>();
  /** Navigation state for the alta link; the catalogue uses it to ask the gate for its picker. */
  readonly registerState = input<Record<string, unknown> | undefined>(undefined);
  readonly companionLink = input.required<readonly string[]>();
  readonly lookupLink = input<readonly string[] | undefined>(undefined);
  /** `false` hides the alta card when no sede of the event can take one. */
  readonly canRegister = input(true);
}
