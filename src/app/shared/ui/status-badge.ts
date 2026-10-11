import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n';

/** Every status the platform can show, namespaced by entity. */
export type StatusKind =
  | 'event.draft'
  | 'event.published'
  | 'event.closed'
  | 'event.archived'
  | 'establishment.active'
  | 'establishment.inactive'
  | 'participation.open'
  | 'participation.closed'
  | 'participation.cancelled'
  | 'registration.confirmed'
  | 'registration.waitlisted'
  | 'registration.cancelled'
  | 'user.active'
  | 'user.disabled';

/**
 * Colour-coded status pill.
 *
 * Colours come from the `--status-*` theme tokens, so the pill re-themes with
 * light/dark without any conditional class logic here.
 */
@Component({
  selector: 'app-status-badge',
  imports: [TranslatePipe],
  templateUrl: './status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge {
  readonly kind = input.required<StatusKind>();

  protected readonly labelKey = computed<MessageKey>(() => `status.${this.kind()}` as MessageKey);

  /** `event.draft` → `draft`, which is the suffix used by the status colour tokens. */
  protected readonly tokenSuffix = computed(() => this.kind().split('.').at(-1) ?? 'draft');

  protected readonly cssVars = computed(() => ({
    'background-color': `var(--status-${this.tokenSuffix()}-bg)`,
    color: `var(--status-${this.tokenSuffix()}-fg)`,
  }));
}
