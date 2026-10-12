import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';
import { toApiError } from '@core/api';
import { SessionStore } from '@core/auth';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { errorState, loadedState, loadingState, type AsyncState } from '@core/utils/async-state';
import {
  ButtonDirective,
  EmptyState,
  EventInvite,
  Icon,
  PageHeader,
  Select,
  Skeleton,
  type IconName,
  type SelectChoice,
} from '@shared/ui';
import { listenCheckIns } from '../../check-in/check-in-events';
import {
  RegistrationDeskApi,
  type DeskMetrics,
  type DeskSummary,
} from '../../registration-desk/registration-desk.api';
import { CheckInDonut } from '../charts/check-in-donut';
import { SedeBars } from '../charts/sede-bars';
import { TimelineChart } from '../charts/timeline-chart';
import { CountUpDirective } from '../count-up.directive';
import {
  DashboardApi,
  type ActivityItem,
  type DashboardOverview,
  type OverviewEvent,
  type RegistrationTimeline,
} from '../dashboard.api';
import { isLivePhase, phaseLabel, phaseTone } from '../event-phase';

/** Same cadence as the registration desk: a cheap summary poll, the rest only on change. */
const POLL_MS = 20_000;
const STALE_MS = 10_000;
const ACTIVITY_SIZE = 8;
const EVENTS_SHOWN = 6;
const ACTIVE_PHASES = new Set(['upcoming', 'registration_open', 'registration_closed', 'in_progress']);

type KpiId = 'events' | 'titulares' | 'people' | 'checkedIn' | 'pending' | 'attendance';
type KpiTone = 'primary' | 'info' | 'success' | 'warning' | 'accent' | 'neutral';

export interface Kpi {
  readonly id: KpiId;
  readonly label: MessageKey;
  readonly icon: IconName;
  readonly tone: KpiTone;
  /** `null` when there is not enough data: the card says so instead of showing a number. */
  readonly value: number | null;
  readonly format: (value: number) => string;
  readonly note: string;
  /** Only from real history (registrations in the last 24 h). */
  readonly trend?: string;
  /** 0..100 */
  readonly progress?: number;
  readonly global?: boolean;
}

export interface Attention {
  readonly tone: 'warning' | 'info';
  readonly message: string;
  readonly link?: {
    readonly route: string;
    readonly label: MessageKey;
    readonly query?: Record<string, string>;
  };
}

const count = (value: number): string => Math.round(value).toLocaleString('es-CO');
const percent = (rate: number): string =>
  `${(Math.round(rate * 10) / 10).toLocaleString('es-CO')}%`;

/**
 * Panel home: platform overview plus the metrics of one event (and optionally one sede).
 *
 * Every number is computed by the API. Event metrics come from the same
 * `GET /check-in/summary` the registration desk uses, so both screens always agree;
 * the overview, timeline and activity come from `GET /dashboard/*`.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    TranslatePipe,
    ButtonDirective,
    EmptyState,
    EventInvite,
    Icon,
    PageHeader,
    Select,
    Skeleton,
    CountUpDirective,
    TimelineChart,
    CheckInDonut,
    SedeBars,
  ],
  templateUrl: './dashboard-page.html',
  styleUrls: ['./dashboard-page.css', './dashboard-events.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  readonly evento = input<string | undefined>(undefined);
  readonly sede = input<string | undefined>(undefined);
  /** Admin only. Empty means every client. */
  readonly cliente = input<string | undefined>(undefined);

  readonly #router = inject(Router);
  readonly #api = inject(DashboardApi);
  readonly #desk = inject(RegistrationDeskApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);

  protected readonly isAdmin = inject(SessionStore).isAdmin;
  protected readonly phaseLabel = phaseLabel;
  protected readonly phaseTone = phaseTone;
  protected readonly isLivePhase = isLivePhase;
  protected readonly kpiPlaceholders = [1, 2, 3, 4, 5, 6];
  protected readonly countFormat = count;

  protected readonly overview = signal<AsyncState<DashboardOverview>>(loadingState());
  protected readonly summary = signal<AsyncState<DeskSummary>>(loadingState());
  protected readonly timeline = signal<AsyncState<RegistrationTimeline>>(loadingState());
  protected readonly activity = signal<AsyncState<readonly ActivityItem[]>>(loadingState());
  protected readonly refreshing = signal(false);
  protected readonly refreshFailed = signal(false);
  protected readonly updatedAt = signal<number | null>(null);
  readonly #now = signal(Date.now());

  protected readonly overviewValue = computed(() => valueOf(this.overview()));
  protected readonly summaryValue = computed(() => valueOf(this.summary()));
  protected readonly timelineValue = computed(() => valueOf(this.timeline()));
  protected readonly activityItems = computed(() => valueOf(this.activity()) ?? []);

  protected readonly events = computed(() => this.overviewValue()?.items ?? []);
  /** Slug from `?cliente=`. Operators ignore it: they only see their own events. */
  protected readonly clientSlug = computed(() =>
    this.isAdmin() ? (this.cliente()?.trim() ?? '') : '',
  );
  protected readonly clients = computed(() => {
    const seen = new Map<string, NonNullable<OverviewEvent['client']>>();
    for (const event of this.events()) {
      if (event.client) {
        seen.set(event.client.slug, event.client);
      }
    }
    return [...seen.values()];
  });
  protected readonly selectedClient = computed(
    () => this.clients().find((client) => client.slug === this.clientSlug()) ?? null,
  );
  /** Events of the client in the URL, or every event when no client is chosen. */
  protected readonly scopedEvents = computed(() => {
    const slug = this.clientSlug();
    const items = this.events();
    return slug ? items.filter((event) => event.client?.slug === slug) : items;
  });
  /**
   * An admin with no event in the URL sees the current scope (every client, or the
   * one named in `?cliente=`). A named event is never replaced by the first one.
   */
  protected readonly selectedEvent = computed<OverviewEvent | null>(() => {
    const items = this.scopedEvents();
    const requested = this.evento();
    if (requested) {
      return items.find((event) => event.id === requested) ?? null;
    }
    if (this.isAdmin()) {
      return null;
    }
    return items[0] ?? null;
  });
  /** A sede from the URL only counts if it belongs to the selected event. */
  protected readonly sedeId = computed(() => {
    const id = this.sede();
    return id && this.selectedEvent()?.sedes.some((sede) => sede.participationId === id)
      ? id
      : undefined;
  });
  protected readonly sedeName = computed(
    () =>
      this.selectedEvent()?.sedes.find((sede) => sede.participationId === this.sedeId())?.name ??
      null,
  );
  protected readonly shownEvents = computed(() => this.scopedEvents().slice(0, EVENTS_SHOWN));
  protected readonly aforoQuery = signal('');
  protected readonly aforoPhase = signal('');
  protected readonly aforoPhaseChoices = computed<readonly SelectChoice[]>(() => {
    const phases = [
      'in_progress',
      'registration_open',
      'registration_closed',
      'upcoming',
      'finished',
      'draft',
      'archived',
    ] as const;
    return [
      { value: '', label: this.#i18n.t('dash.aforo.allPhases') },
      ...phases.map((phase) => ({ value: phase, label: this.#i18n.t(phaseLabel(phase)) })),
    ];
  });
  protected readonly aforoRows = computed(() => {
    const term = this.aforoQuery().trim().toLocaleLowerCase('es');
    const phase = this.aforoPhase();
    return this.scopedEvents().filter((event) => {
      if (phase && event.phase !== phase) {
        return false;
      }
      if (!term) {
        return true;
      }
      const haystack = `${event.name} ${event.client?.displayName ?? ''}`.toLocaleLowerCase('es');
      return haystack.includes(term);
    });
  });

  protected readonly kpis = computed<readonly Kpi[]>(() => {
    const overview = this.overviewValue();
    const summary = this.summaryValue();
    const event = this.selectedEvent();
    if (!overview || !summary || !event) {
      return [];
    }
    return buildKpis({
      totals: summary.totals,
      overview,
      operational:
        event.phase === 'in_progress' || event.phase === 'finished' || summary.totals.checkedIn > 0,
      last24h: this.timelineValue()?.last24h ?? null,
      lastCheckIn: summary.totals.lastCheckInAt ? this.time(summary.totals.lastCheckInAt) : null,
      t: (key, params) => this.#i18n.t(key, params),
    });
  });

  protected readonly attention = computed<readonly Attention[]>(() => {
    const event = this.selectedEvent();
    const summary = this.summaryValue();
    return event
      ? buildAttention(event, summary, {
          isAdmin: this.isAdmin(),
          date: (iso) => this.date(iso),
          t: (key, params) => this.#i18n.t(key, params),
        })
      : [];
  });

  protected readonly updatedLabel = computed(() => {
    const at = this.updatedAt();
    if (at === null) {
      return '';
    }
    const seconds = Math.max(0, Math.round((this.#now() - at) / 1000));
    const clock = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(
      at,
    );
    const ago =
      seconds < 10
        ? this.#i18n.t('dash.justNow')
        : seconds < 60
          ? `${seconds} s`
          : `${Math.floor(seconds / 60)} min`;
    return this.#i18n.t('dash.updatedAt', { time: clock, ago });
  });

  protected readonly overviewError = computed(() => this.#message(this.overview()));
  protected readonly summaryError = computed(() => this.#message(this.summary()));

  readonly #scopeKey = computed(() => {
    const event = this.selectedEvent();
    return event === null ? null : `${event.id}|${this.sedeId() ?? ''}`;
  });

  #subscriptions: Partial<Record<'overview' | 'summary' | 'timeline' | 'activity', Subscription>> =
    {};
  #signature = '';

  constructor() {
    this.#loadOverview(false);

    effect(() => {
      const key = this.#scopeKey();
      untracked(() => {
        if (key !== null) {
          this.#signature = '';
          this.#loadSummary(false);
          this.#loadTimeline(false);
          this.#loadActivity(false);
        }
      });
    });

    const poll = setInterval(() => {
      this.#now.set(Date.now());
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        this.#refresh(false);
      }
    }, POLL_MS);
    const tick = setInterval(() => this.#now.set(Date.now()), 5_000);
    const onVisible = (): void => {
      const at = this.updatedAt();
      if (document.visibilityState === 'visible' && (at === null || Date.now() - at > STALE_MS)) {
        this.#refresh(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const stopListening = listenCheckIns((notice) => {
      if (notice.eventId === this.selectedEvent()?.id) {
        this.#refresh(true);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      stopListening();
      Object.values(this.#subscriptions).forEach((subscription) => subscription?.unsubscribe());
    });
  }

  /* ── Filters ─────────────────────────────────────────────────────────────── */

  protected readonly eventChoices = computed<readonly SelectChoice[]>(() => {
    const clientChosen = this.selectedClient() !== null;
    const events = this.scopedEvents().map((event) => ({
      value: event.id,
      label:
        this.isAdmin() && !clientChosen && event.client
          ? `${event.name} · ${event.client.displayName}`
          : event.name,
    }));
    return this.isAdmin()
      ? [{ value: '', label: this.#i18n.t('dash.context.allEvents') }, ...events]
      : events;
  });

  protected readonly clientChoices = computed<readonly SelectChoice[]>(() => [
    { value: '', label: this.#i18n.t('dash.aforo.allClients') },
    ...this.clients().map((client) => ({ value: client.slug, label: client.displayName })),
  ]);

  protected readonly scopeStats = computed(() => {
    const items = this.scopedEvents();
    return {
      events: items.length,
      active: items.filter((event) => ACTIVE_PHASES.has(event.phase)).length,
      people: items.reduce((total, event) => total + event.people, 0),
      entered: items.reduce((total, event) => total + event.checkedIn, 0),
    };
  });

  protected selectClient(slug: string): void {
    void this.#router.navigate(['/panel'], {
      queryParams: { cliente: slug || null, evento: null, sede: null },
    });
  }

  protected selectEvent(id: string): void {
    const event = this.events().find((item) => item.id === id);
    void this.#router.navigate(['/panel'], {
      queryParams: {
        cliente: id ? (event?.client?.slug ?? this.clientSlug() ?? null) : this.clientSlug() || null,
        evento: id || null,
        sede: null,
      },
    });
  }

  protected selectSede(participationId: string | null): void {
    void this.#router.navigate(['/panel'], {
      queryParams: { sede: participationId },
      queryParamsHandling: 'merge',
    });
  }

  protected refresh(): void {
    this.#refresh(true);
  }

  protected retry(): void {
    if (this.overview().status === 'error') {
      this.#loadOverview(false);
      return;
    }
    this.#loadSummary(false);
    this.#loadTimeline(false);
    this.#loadActivity(false);
  }

  /* ── Presentation helpers ────────────────────────────────────────────────── */

  protected deskQuery(extra: Record<string, string> = {}): Record<string, string> {
    const event = this.selectedEvent();
    const sede = this.sedeId();
    return { ...(event ? { evento: event.id } : {}), ...(sede ? { sede } : {}), ...extra };
  }

  protected percent(rate: number): string {
    return percent(rate * 100);
  }

  protected onAforoQuery(event: Event): void {
    this.aforoQuery.set((event.target as HTMLInputElement).value);
  }

  protected occupancyText(value: number): string {
    return `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
  }

  protected levelKey(level: OverviewEvent['occupancyLevel']): MessageKey {
    return `participations.level.${level}` as MessageKey;
  }

  protected sedeNames(event: OverviewEvent): string {
    return event.sedes.map((sede) => sede.name).join(', ');
  }

  protected folio(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  protected turnLabel(turn: { first: number; last: number | null }): string {
    return turn.last !== null && turn.last !== turn.first
      ? `${turn.first}–${turn.last}`
      : `${turn.first}`;
  }

  protected time(iso: string): string {
    return this.#format(iso, { hour: 'numeric', minute: '2-digit' });
  }

  protected date(iso: string): string {
    return this.#format(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected when(iso: string): string {
    const day = this.#format(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = this.#format(new Date(this.#now()).toISOString(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return day === today
      ? this.time(iso)
      : this.#format(iso, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  protected dateRange(event: OverviewEvent): string {
    if (!event.startsAt) {
      return '';
    }
    const start = this.#format(
      event.startsAt,
      { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
      event.timezone,
    );
    if (!event.endsAt) {
      return start;
    }
    const sameDay =
      this.#format(event.startsAt, { dateStyle: 'short' }, event.timezone) ===
      this.#format(event.endsAt, { dateStyle: 'short' }, event.timezone);
    const end = this.#format(
      event.endsAt,
      sameDay
        ? { hour: 'numeric', minute: '2-digit' }
        : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' },
      event.timezone,
    );
    return `${start} – ${end}`;
  }

  protected activityIcon(item: ActivityItem): IconName {
    switch (item.type) {
      case 'registration':
        return 'user-plus';
      case 'check_in':
        return 'log-in';
      case 'event_created':
        return 'calendar';
      case 'event_updated':
        return 'pencil';
    }
  }

  /* ── Loading ─────────────────────────────────────────────────────────────── */

  #refresh(force: boolean): void {
    if (this.refreshing()) {
      return;
    }
    if (this.overview().status !== 'loaded') {
      this.#loadOverview(false);
      return;
    }
    if (force) {
      this.#loadOverview(true);
    }
    this.#loadSummary(true, force);
  }

  #loadOverview(silent: boolean): void {
    this.#subscriptions.overview?.unsubscribe();
    if (!silent) {
      this.overview.set(loadingState());
    }
    this.#subscriptions.overview = this.#api.overview().subscribe({
      next: (overview) => {
        this.overview.set(loadedState(overview));
        this.#touch();
      },
      error: (error: unknown) => {
        if (silent && this.overview().status === 'loaded') {
          this.refreshFailed.set(true);
        } else {
          this.overview.set(errorState(toApiError(error)));
        }
      },
    });
  }

  #loadSummary(silent: boolean, forceDependents = false): void {
    const event = this.selectedEvent();
    if (event === null) {
      return;
    }
    this.#subscriptions.summary?.unsubscribe();
    if (silent) {
      this.refreshing.set(true);
    } else {
      this.summary.set(loadingState());
    }
    this.#subscriptions.summary = this.#desk.summary(event.id, this.sedeId()).subscribe({
      next: (summary) => {
        const signature = JSON.stringify([summary.totals, summary.sedes]);
        const changed = this.#signature !== '' && signature !== this.#signature;
        this.#signature = signature;
        this.summary.set(loadedState(summary));
        this.refreshing.set(false);
        this.refreshFailed.set(false);
        this.#touch();
        if (silent && (changed || forceDependents)) {
          this.#loadTimeline(true);
          this.#loadActivity(true);
          if (changed && !forceDependents) {
            this.#loadOverview(true);
          }
        }
      },
      error: (error: unknown) => {
        this.refreshing.set(false);
        if (silent && this.summary().status === 'loaded') {
          this.refreshFailed.set(true);
        } else {
          this.summary.set(errorState(toApiError(error)));
        }
      },
    });
  }

  #loadTimeline(silent: boolean): void {
    const scope = this.#scope();
    if (scope === null) {
      return;
    }
    this.#subscriptions.timeline?.unsubscribe();
    if (!silent) {
      this.timeline.set(loadingState());
    }
    this.#subscriptions.timeline = this.#api.timeline(scope).subscribe({
      next: (timeline) => this.timeline.set(loadedState(timeline)),
      error: (error: unknown) => {
        if (!(silent && this.timeline().status === 'loaded')) {
          this.timeline.set(errorState(toApiError(error)));
        }
      },
    });
  }

  #loadActivity(silent: boolean): void {
    const scope = this.#scope();
    if (scope === null) {
      return;
    }
    this.#subscriptions.activity?.unsubscribe();
    if (!silent) {
      this.activity.set(loadingState());
    }
    this.#subscriptions.activity = this.#api.activity(scope, ACTIVITY_SIZE).subscribe({
      next: (items) => this.activity.set(loadedState(items)),
      error: (error: unknown) => {
        if (!(silent && this.activity().status === 'loaded')) {
          this.activity.set(errorState(toApiError(error)));
        }
      },
    });
  }

  #scope(): { eventId: string; participationId?: string } | null {
    const event = this.selectedEvent();
    return event === null ? null : { eventId: event.id, participationId: this.sedeId() };
  }

  #touch(): void {
    this.updatedAt.set(Date.now());
    this.#now.set(Date.now());
  }

  #message(state: AsyncState<unknown>): string {
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  }

  #format(iso: string, options: Intl.DateTimeFormatOptions, timezone?: string): string {
    return new Intl.DateTimeFormat('es-CO', {
      ...options,
      timeZone: timezone ?? (this.selectedEvent()?.timezone || 'America/Bogota'),
    }).format(new Date(iso));
  }
}

function valueOf<T>(state: AsyncState<T>): T | null {
  return state.status === 'loaded' ? state.value : null;
}

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Six cards, three of them promoted. Before the event the registration numbers lead;
 * once scanning starts (or the event is over) entry numbers lead.
 */
export function buildKpis(input: {
  readonly totals: DeskMetrics;
  readonly overview: DashboardOverview;
  readonly operational: boolean;
  readonly last24h: number | null;
  readonly lastCheckIn: string | null;
  readonly t: Translate;
}): readonly Kpi[] {
  const { totals, overview, t } = input;
  const hasTitulares = totals.titulares > 0;

  const cards: Record<KpiId, Kpi> = {
    events: {
      id: 'events',
      label: 'dash.kpi.events',
      icon: 'calendar',
      tone: 'neutral',
      value: overview.events.total,
      format: count,
      note: t(overview.events.active === 1 ? 'dash.kpi.eventsNoteOne' : 'dash.kpi.eventsNote', {
        active: count(overview.events.active),
      }),
      global: true,
    },
    titulares: {
      id: 'titulares',
      label: 'dash.kpi.titulares',
      icon: 'ticket',
      tone: 'primary',
      value: totals.titulares,
      format: count,
      note: t('dash.kpi.titularesNote'),
      trend:
        input.last24h !== null && input.last24h > 0
          ? t('dash.kpi.trend24h', { count: count(input.last24h) })
          : undefined,
    },
    people: {
      id: 'people',
      label: 'dash.kpi.people',
      icon: 'users',
      tone: 'info',
      value: totals.people,
      format: count,
      note: t('dash.kpi.peopleNote', {
        titulares: count(totals.titulares),
        companions: count(totals.companions),
      }),
    },
    checkedIn: {
      id: 'checkedIn',
      label: 'dash.kpi.checkedIn',
      icon: 'log-in',
      tone: 'success',
      value: totals.checkedIn,
      format: count,
      note: input.lastCheckIn
        ? t('dash.kpi.lastCheckIn', { time: input.lastCheckIn })
        : t('dash.kpi.noCheckIns'),
    },
    pending: {
      id: 'pending',
      label: 'dash.kpi.pending',
      icon: 'clock',
      tone: 'warning',
      value: totals.pending,
      format: count,
      note: hasTitulares ? t('dash.kpi.pendingNote') : t('dash.kpi.noTitulares'),
    },
    attendance: {
      id: 'attendance',
      label: 'dash.kpi.attendance',
      icon: 'pie-chart',
      tone: 'accent',
      value: hasTitulares ? Math.round(totals.attendanceRate * 1000) / 10 : null,
      format: percent,
      note: hasTitulares
        ? t('dash.kpi.attendanceNote', {
            checked: count(totals.checkedIn),
            total: count(totals.titulares),
          })
        : t('dash.kpi.noTitulares'),
      progress: hasTitulares ? Math.round(totals.attendanceRate * 100) : undefined,
    },
  };

  const order: readonly KpiId[] = input.operational
    ? ['checkedIn', 'pending', 'attendance', 'titulares', 'people', 'events']
    : ['titulares', 'people', 'attendance', 'checkedIn', 'pending', 'events'];
  return order.map((id) => cards[id]);
}

/** Facts about the selected event worth a second look; nothing is inferred beyond the data. */
export function buildAttention(
  event: OverviewEvent,
  summary: DeskSummary | null,
  context: {
    readonly isAdmin: boolean;
    readonly date: (iso: string) => string;
    readonly t: Translate;
  },
): readonly Attention[] {
  const { t } = context;
  const items: Attention[] = [];
  const edit = context.isAdmin
    ? { route: `/panel/eventos/${event.id}/editar`, label: 'dash.attention.edit' as MessageKey }
    : undefined;

  if (event.phase === 'finished') {
    items.push({
      tone: 'info',
      message: event.endsAt
        ? t('dash.attention.finishedOn', { date: context.date(event.endsAt) })
        : t('dash.attention.finished'),
    });
  }
  if (event.phase === 'draft') {
    items.push({ tone: 'warning', message: t('dash.attention.draft'), link: edit });
  }
  if (event.phase === 'archived') {
    items.push({ tone: 'info', message: t('dash.attention.archived') });
  }
  if (event.sedes.length === 0) {
    items.push({ tone: 'warning', message: t('dash.attention.noSedes'), link: edit });
  }
  if (summary && event.phase === 'registration_open' && summary.totals.titulares === 0) {
    items.push({ tone: 'info', message: t('dash.attention.noRegistrations') });
  }
  if (summary && summary.sedes.length > 1 && summary.sedes.some((sede) => sede.titulares > 0)) {
    for (const sede of summary.sedes.filter((item) => item.titulares === 0)) {
      items.push({
        tone: 'warning',
        message: t('dash.attention.sedeEmpty', { name: sede.establishment.name }),
      });
    }
  }
  if (summary && event.phase === 'in_progress') {
    for (const sede of summary.sedes.filter((item) => item.pending > 0)) {
      items.push({
        tone: 'info',
        message: t('dash.attention.sedePending', {
          name: sede.establishment.name,
          count: count(sede.pending),
        }),
        link: {
          route: '/panel/mesa',
          label: 'dash.attention.openDesk',
          query: { evento: event.id, sede: sede.participationId, ingreso: 'pending' },
        },
      });
    }
  }
  return items;
}
