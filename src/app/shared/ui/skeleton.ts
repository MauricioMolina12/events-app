import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Shimmer block. Size it from the outside (`class="h-5 w-40"`), which keeps the
 * component single-purpose and lets every loading state match its final layout.
 */
@Component({
  selector: 'app-skeleton',
  template: '',
  host: {
    class: 'skeleton block',
    '[attr.aria-hidden]': '"true"',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  /** Optional line count for paragraph placeholders. */
  readonly lines = input(1);
}
