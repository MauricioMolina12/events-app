import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import type { RegistrationTimeline, TimelineBucket } from '../dashboard.api';

type Mode = 'period' | 'cumulative';

const MAX_X_LABELS = 6;

interface Point {
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly label: string;
  readonly detail: string;
}

/**
 * Registered titulares over time, as served by `GET /dashboard/registrations-timeline`.
 *
 * Plain SVG on a 100×100 viewBox stretched to the container; strokes are
 * non-scaling and every label lives in HTML, so text never distorts and the
 * colours come straight from the theme tokens.
 */
@Component({
  selector: 'app-timeline-chart',
  imports: [TranslatePipe],
  templateUrl: './timeline-chart.html',
  styleUrl: './charts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineChart {
  readonly timeline = input.required<RegistrationTimeline>();

  readonly #i18n = inject(I18nService);

  protected readonly mode = signal<Mode>('period');
  protected readonly active = signal<number | null>(null);

  protected readonly points = computed<readonly Point[]>(() => {
    const { buckets, granularity } = this.timeline();
    const values = buckets.map((bucket) => this.#value(bucket));
    const max = niceMax(Math.max(0, ...values));
    const count = buckets.length;
    const spansDays = granularity === 'hour' && buckets[0]?.date !== buckets.at(-1)?.date;
    return buckets.map((bucket, index) => ({
      x: count === 1 ? 50 : (index / (count - 1)) * 100,
      y: 100 - (values[index]! / max) * 100,
      value: values[index]!,
      label: this.#label(bucket, granularity, spansDays),
      detail: this.#detail(bucket, granularity),
    }));
  });

  protected readonly ticks = computed(() => {
    const max = niceMax(
      Math.max(0, ...this.timeline().buckets.map((bucket) => this.#value(bucket))),
    );
    return [1, 0.75, 0.5, 0.25, 0].map((fraction) => ({
      value: Math.round(max * fraction).toLocaleString('es-CO'),
      top: (1 - fraction) * 100,
    }));
  });

  protected readonly linePath = computed(() =>
    this.points()
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${round(point.x)} ${round(point.y)}`)
      .join(' '),
  );

  protected readonly areaPath = computed(() => {
    const points = this.points();
    if (points.length < 2) {
      return '';
    }
    return `${this.linePath()} L100 100 L0 100 Z`;
  });

  protected readonly xLabels = computed(() => {
    const points = this.points();
    const step = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
    return points
      .map((point, index) => ({ index, x: point.x, label: point.label }))
      .filter(({ index }) => index % step === 0);
  });

  protected readonly peak = computed(() => {
    const { buckets, granularity } = this.timeline();
    let best: TimelineBucket | null = null;
    for (const bucket of buckets) {
      if (best === null || bucket.titulares > best.titulares) {
        best = bucket;
      }
    }
    return best === null || best.titulares === 0
      ? null
      : { value: best.titulares, label: this.#detail(best, granularity) };
  });

  protected readonly activePoint = computed(() => {
    const index = this.active();
    return index === null ? null : (this.points()[index] ?? null);
  });

  protected readonly granularityKey = computed(
    () => `dash.timeline.by.${this.timeline().granularity}` as MessageKey,
  );

  protected readonly summaryLabel = computed(() => {
    const peak = this.peak();
    return this.#i18n.t('dash.timeline.aria', {
      total: this.timeline().total.toLocaleString('es-CO'),
      peak: peak ? `${peak.value} · ${peak.label}` : '—',
    });
  });

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  protected onPointer(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const count = this.points().length;
    if (count === 0 || rect.width === 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.active.set(count === 1 ? 0 : Math.round(ratio * (count - 1)));
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.points().length;
    if (count === 0) {
      return;
    }
    const current = this.active() ?? count - 1;
    const next =
      event.key === 'ArrowLeft'
        ? Math.max(0, current - 1)
        : event.key === 'ArrowRight'
          ? Math.min(count - 1, current + 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (next !== null) {
      event.preventDefault();
      this.active.set(next);
    }
  }

  protected clear(): void {
    this.active.set(null);
  }

  protected tooltipLeft(x: number): number {
    return Math.min(88, Math.max(12, x));
  }

  #value(bucket: TimelineBucket): number {
    return this.mode() === 'cumulative' ? bucket.cumulative : bucket.titulares;
  }

  #label(
    bucket: TimelineBucket,
    granularity: RegistrationTimeline['granularity'],
    spansDays: boolean,
  ): string {
    if (granularity === 'hour') {
      const hour = formatUtc(bucket.date, { hour: 'numeric' }, bucket.hour ?? 0);
      return spansDays && bucket.hour === 0
        ? formatUtc(bucket.date, { day: 'numeric', month: 'short' })
        : hour;
    }
    return formatUtc(bucket.date, { day: 'numeric', month: 'short' });
  }

  #detail(bucket: TimelineBucket, granularity: RegistrationTimeline['granularity']): string {
    if (granularity === 'hour') {
      return `${formatUtc(bucket.date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${formatUtc(bucket.date, { hour: 'numeric', minute: '2-digit' }, bucket.hour ?? 0)}`;
    }
    if (granularity === 'week') {
      return this.#i18n.t('dash.timeline.weekOf', {
        date: formatUtc(bucket.date, { day: 'numeric', month: 'short', year: 'numeric' }),
      });
    }
    return formatUtc(bucket.date, { weekday: 'short', day: 'numeric', month: 'short' });
  }
}

/** Local dates arrive as plain strings; formatting them in UTC keeps the day the server chose. */
function formatUtc(date: string, options: Intl.DateTimeFormatOptions, hour = 0): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-CO', { ...options, timeZone: 'UTC' }).format(
    new Date(Date.UTC(year!, month! - 1, day!, hour)),
  );
}

/** Upper bound split into four integer steps. */
export function niceMax(value: number): number {
  if (value <= 4) {
    return 4;
  }
  const raw = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factors = magnitude >= 10 ? [1, 2, 2.5, 3, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10];
  const step = factors.map((factor) => factor * magnitude).find((candidate) => candidate >= raw)!;
  return step * 4;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
