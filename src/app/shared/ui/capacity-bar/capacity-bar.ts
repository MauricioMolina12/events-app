import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@core/i18n';

/** Capacity indicator for an event's venue: how many of the N slots are taken. */
@Component({
  selector: 'app-capacity-bar',
  imports: [TranslatePipe],
  templateUrl: './capacity-bar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapacityBar {
  readonly taken = input.required<number>();
  readonly capacity = input.required<number>();
  readonly waitlisted = input(0);

  protected readonly remaining = computed(() => Math.max(0, this.capacity() - this.taken()));

  protected readonly percent = computed(() => {
    const capacity = this.capacity();
    if (capacity <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.taken() / capacity) * 100));
  });

  /** Whole-percent thresholds are enough to drive the semantic colour. */
  protected readonly tone = computed(() => {
    const ratio = this.percent();
    if (ratio >= 100) {
      return 'bg-[var(--danger)]';
    }
    if (ratio >= 80) {
      return 'bg-[var(--warning)]';
    }
    return 'bg-[var(--success)]';
  });
}
