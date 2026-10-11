import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslatePipe, type MessageKey } from '@core/i18n';

type Segment = 'checkedIn' | 'pending';

interface SegmentView {
  readonly id: Segment;
  readonly label: MessageKey;
  readonly value: number;
  readonly percent: number;
  readonly dash: string;
  readonly offset: number;
}

/**
 * Titulares inside versus still pending. Companions are left out on purpose: their
 * entry is not verified one by one, so they never count as attendance.
 */
@Component({
  selector: 'app-check-in-donut',
  imports: [TranslatePipe],
  templateUrl: './check-in-donut.html',
  styleUrl: './charts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckInDonut {
  readonly checkedIn = input.required<number>();
  readonly pending = input.required<number>();

  protected readonly focus = signal<Segment | null>(null);

  protected readonly total = computed(() => this.checkedIn() + this.pending());

  protected readonly segments = computed<readonly SegmentView[]>(() => {
    const total = this.total();
    const share = (value: number): number => (total === 0 ? 0 : (value / total) * 100);
    const inside = share(this.checkedIn());
    return [
      {
        id: 'checkedIn',
        label: 'dash.checkIn.inside',
        value: this.checkedIn(),
        percent: inside,
        dash: `${inside} ${100 - inside}`,
        offset: 25,
      },
      {
        id: 'pending',
        label: 'dash.checkIn.pending',
        value: this.pending(),
        percent: 100 - inside,
        dash: `${100 - inside} ${inside}`,
        offset: 25 - inside,
      },
    ];
  });

  protected readonly center = computed(() => {
    const focused = this.segments().find((segment) => segment.id === this.focus());
    const segment = focused ?? this.segments()[0]!;
    return { value: formatPercent(segment.percent), label: segment.label, count: segment.value };
  });

  protected percent(value: number): string {
    return formatPercent(value);
  }

  protected setFocus(segment: Segment | null): void {
    this.focus.set(segment);
  }
}

function formatPercent(value: number): string {
  return `${(Math.round(value * 10) / 10).toLocaleString('es-CO')}%`;
}
