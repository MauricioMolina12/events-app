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
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, type Subscription } from 'rxjs';
import { toApiError, type Page } from '@core/api';
import type { DocumentType, Event } from '@core/domain';
import { DOCUMENT_TYPES } from '@core/domain';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import {
  errorState,
  loadedState,
  loadingState,
  toAsyncState,
  type AsyncState,
} from '@core/utils/async-state';
import { formatDocument } from '@core/utils/documents';
import {
  ButtonDirective,
  EmptyState,
  EventInvite,
  Icon,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  type IconName,
  type SelectChoice,
} from '@shared/ui';
import { EventsApi } from '../../events/events.api';
import { RegistrationsApi } from '../../registrations/registrations.api';
import { listenCheckIns } from '../../check-in/check-in-events';
import {
  RegistrationDeskApi,
  type CheckInStatus,
  type DeskCompanion,
  type DeskMetrics,
  type DeskQuery,
  type DeskRow,
  type DeskSort,
  type DeskSummary,
  type SortOrder,
} from '../registration-desk.api';

/** Cheap summary poll; the table and history are only re-read when the summary changed. */
const POLL_MS = 20_000;
/** Coming back to the tab refreshes only if the data is older than this. */
const STALE_MS = 10_000;
const SEARCH_DEBOUNCE_MS = 350;
const HISTORY_SIZE = 6;
const PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100];
const SORTS: readonly DeskSort[] = ['registeredAt', 'fullName', 'checkedInAt', 'turn'];
const SKELETON_ROWS: readonly number[] = [1, 2, 3, 4, 5, 6];
const KPI_PLACEHOLDERS: readonly number[] = [1, 2, 3, 4, 5];

type KpiTone = 'primary' | 'info' | 'success' | 'warning' | 'accent';

interface Kpi {
  readonly id: string;
  readonly label: MessageKey;
  readonly icon: IconName;
  readonly tone: KpiTone;
  readonly value: string;
  readonly note: string;
  /** 0..100, only for the attendance card. */
  readonly progress?: number;
}

/**
 * Mesa de registro: KPIs, per-sede breakdown, latest check-ins and the registrations table
 * of one event. Read-only on purpose: turns are only assigned by the scanner.
 *
 * Filters live in the URL so a refresh or a shared link shows the same view. Every number
 * comes from `GET /check-in/summary`, which applies the same definitions to the sede and
 * the consolidated totals.
 */
@Component({
  selector: 'app-registration-desk-page',
  imports: [
    TranslatePipe,
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    EmptyState,
    EventInvite,
    Icon,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
  ],
  templateUrl: './registration-desk-page.html',
  styleUrl: './registration-desk-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationDeskPage {
  readonly evento = input<string | undefined>(undefined);
  readonly sede = input<string | undefined>(undefined);
  readonly ingreso = input<string | undefined>(undefined);
  readonly q = input('', { transform: (value: string | undefined) => value?.trim() ?? '' });
  readonly orden = input<string | undefined>(undefined);
  readonly dir = input<string | undefined>(undefined);
  readonly limit = input(PAGE_SIZE, {
    transform: (value: unknown) => clampNumber(value, PAGE_SIZE, 1, 100),
  });
  readonly offset = input(0, {
    transform: (value: unknown) => clampNumber(value, 0, 0, Number.MAX_SAFE_INTEGER),
  });

  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #api = inject(RegistrationDeskApi);
  readonly #registrations = inject(RegistrationsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly placeholders = SKELETON_ROWS;
  protected readonly kpiPlaceholders = KPI_PLACEHOLDERS;
  protected readonly documentTypes = DOCUMENT_TYPES;
  protected readonly creating = signal(false);
  protected readonly createError = signal('');
  protected readonly createForm = new FormGroup({
    participationId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    documentType: new FormControl<DocumentType>('CC', { nonNullable: true }),
    documentNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
    email: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
  });

  protected readonly events = toSignal(
    inject(EventsApi).list({ limit: 100 }).pipe(toAsyncState()),
    { initialValue: loadingState<Page<Event>>() },
  );
  protected readonly eventOptions = computed<readonly Event[]>(() => {
    const state = this.events();
    if (state.status !== 'loaded') {
      return [];
    }
    const rank = (event: Event): number =>
      event.status === 'published' ? 0 : event.status === 'closed' ? 1 : event.status === 'draft' ? 2 : 3;
    return [...state.value.items].sort((left, right) => rank(left) - rank(right));
  });
  protected readonly selectedEvent = computed<Event | null>(() => {
    const options = this.eventOptions();
    return options.find((event) => event.id === this.evento()) ?? options[0] ?? null;
  });
  protected readonly eventId = computed(() => this.selectedEvent()?.id ?? null);
  protected readonly sedeId = computed(() => this.sede() || undefined);
  protected readonly checkIn = computed<CheckInStatus | undefined>(() => {
    const value = this.ingreso();
    return value === 'checked_in' || value === 'pending' ? value : undefined;
  });
  protected readonly sort = computed<DeskSort>(() =>
    SORTS.includes(this.orden() as DeskSort) ? (this.orden() as DeskSort) : 'registeredAt',
  );
  protected readonly order = computed<SortOrder>(() => (this.dir() === 'asc' ? 'asc' : 'desc'));
  protected readonly hasFilters = computed(
    () => Boolean(this.checkIn() || this.q() || this.sedeId()),
  );
  protected readonly historyMode = computed(
    () => this.checkIn() === 'checked_in' && this.sort() === 'checkedInAt',
  );

  protected readonly summary = signal<AsyncState<DeskSummary>>(loadingState());
  protected readonly table = signal<AsyncState<Page<DeskRow>>>(loadingState());
  protected readonly history = signal<AsyncState<Page<DeskRow>>>(loadingState());
  protected readonly refreshing = signal(false);
  protected readonly refreshFailed = signal(false);
  protected readonly updatedAt = signal<number | null>(null);
  protected readonly term = signal('');
  readonly #now = signal(Date.now());

  protected readonly summaryValue = computed(() => {
    const state = this.summary();
    return state.status === 'loaded' ? state.value : null;
  });
  protected readonly selectedSede = computed(
    () => this.summaryValue()?.sedes.find((sede) => sede.participationId === this.sedeId()) ?? null,
  );
  protected readonly kpis = computed<readonly Kpi[]>(() => {
    const totals = this.summaryValue()?.totals;
    return totals ? this.#kpis(totals) : [];
  });
  protected readonly updatedLabel = computed(() => {
    const at = this.updatedAt();
    if (at === null) {
      return '';
    }
    const seconds = Math.max(0, Math.round((this.#now() - at) / 1000));
    if (seconds < 10) {
      return this.#i18n.t('desk.updatedJustNow');
    }
    const value = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`;
    return this.#i18n.t('app.updatedAgo', { value });
  });
  protected readonly summaryError = computed(() => {
    const state = this.summary();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly tableError = computed(() => {
    const state = this.table();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly tablePage = computed(() => {
    const state = this.table();
    return state.status === 'loaded' ? state.value : null;
  });
  protected readonly historyItems = computed(() => {
    const state = this.history();
    return state.status === 'loaded' ? state.value.items : [];
  });

  readonly #summaryKey = computed(() => {
    const eventId = this.eventId();
    return eventId === null ? null : `${eventId}|${this.sedeId() ?? ''}`;
  });
  readonly #tableQuery = computed<DeskQuery | null>(
    () => {
      const eventId = this.eventId();
      if (eventId === null) {
        return null;
      }
      return {
        eventId,
        participationId: this.sedeId(),
        checkIn: this.checkIn(),
        search: this.q() || undefined,
        sort: this.sort(),
        order: this.order(),
        limit: this.limit(),
        offset: this.offset(),
      };
    },
    { equal: (left, right) => JSON.stringify(left) === JSON.stringify(right) },
  );

  #subscriptions: Partial<Record<'summary' | 'table' | 'history', Subscription>> = {};
  #companionSubs = new Map<string, Subscription>();
  protected readonly expandedId = signal<string | null>(null);
  readonly #companions = signal<Readonly<Record<string, AsyncState<readonly DeskCompanion[]>>>>({});
  #signature = '';
  #searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => this.term.set(this.q()));
    effect(() => {
      this.historyMode();
      if (this.#route.snapshot.fragment === 'desk-table') {
        queueMicrotask(() =>
          document.getElementById('desk-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        );
      }
    });

    effect(() => {
      const key = this.#summaryKey();
      untracked(() => {
        if (key !== null) {
          this.#loadSummary(false);
          this.#loadHistory(false);
        }
      });
    });

    effect(() => {
      const query = this.#tableQuery();
      untracked(() => {
        if (query !== null) {
          this.#loadTable(query, false);
        }
      });
    });

    const poll = setInterval(() => {
      this.#now.set(Date.now());
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        this.#silentRefresh(false);
      }
    }, POLL_MS);
    const tick = setInterval(() => this.#now.set(Date.now()), 5_000);
    const onVisible = (): void => {
      const at = this.updatedAt();
      if (document.visibilityState === 'visible' && (at === null || Date.now() - at > STALE_MS)) {
        this.#silentRefresh(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const stopListening = listenCheckIns((notice) => {
      if (notice.eventId === this.eventId()) {
        this.#silentRefresh(true);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      clearInterval(tick);
      clearTimeout(this.#searchTimer);
      document.removeEventListener('visibilitychange', onVisible);
      stopListening();
      Object.values(this.#subscriptions).forEach((subscription) => subscription?.unsubscribe());
      this.#companionSubs.forEach((subscription) => subscription.unsubscribe());
    });
  }

  /* ── Filters ─────────────────────────────────────────────────────────────── */

  protected readonly eventChoices = computed<readonly SelectChoice[]>(() =>
    this.eventOptions().map((event) => ({ value: event.id, label: this.eventLabel(event) })),
  );
  protected readonly sedeChoices = computed<readonly SelectChoice[]>(() => [
    { value: '', label: this.#i18n.t('desk.filter.allSedes') },
    ...(this.summaryValue()?.sedes ?? []).map((sede) => ({
      value: sede.participationId,
      label: sede.establishment.name,
    })),
  ]);
  protected readonly checkInChoices = computed<readonly SelectChoice[]>(() => [
    { value: '', label: this.#i18n.t('desk.filter.checkInAll') },
    { value: 'checked_in', label: this.#i18n.t('desk.status.checkedIn') },
    { value: 'pending', label: this.#i18n.t('desk.status.pending') },
  ]);

  protected selectEvent(value: string): void {
    this.#navigate({ evento: value, sede: null, offset: null });
  }

  protected selectSede(participationId: string | null): void {
    this.#navigate({ sede: participationId, offset: null });
  }

  protected onSedeChange(value: string): void {
    this.selectSede(value || null);
  }

  protected onCheckInChange(value: string): void {
    this.#navigate({ ingreso: value || null, offset: null });
  }

  protected onTermInput(event: globalThis.Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    clearTimeout(this.#searchTimer);
    this.#searchTimer = setTimeout(() => this.#applySearch(), SEARCH_DEBOUNCE_MS);
  }

  protected submitSearch(event: globalThis.Event): void {
    event.preventDefault();
    clearTimeout(this.#searchTimer);
    this.#applySearch();
  }

  protected clearFilters(): void {
    this.term.set('');
    this.#navigate({ sede: null, ingreso: null, q: null, offset: null });
  }

  protected showHistory(): void {
    this.#navigate({ ingreso: 'checked_in', orden: 'checkedInAt', dir: 'desc', offset: null });
    document.getElementById('desk-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected sortBy(sort: DeskSort): void {
    const order: SortOrder =
      this.sort() === sort ? (this.order() === 'asc' ? 'desc' : 'asc') : sort === 'fullName' ? 'asc' : 'desc';
    this.#navigate({ orden: sort, dir: order, offset: null });
  }

  protected ariaSort(sort: DeskSort): 'ascending' | 'descending' | 'none' {
    if (this.sort() !== sort) {
      return 'none';
    }
    return this.order() === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(sort: DeskSort): IconName {
    if (this.sort() !== sort) {
      return 'arrow-up-down';
    }
    return this.order() === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected onOffsetChange(offset: number): void {
    this.#navigate({ offset });
  }

  protected onLimitChange(limit: number): void {
    this.#navigate({ limit, offset: 0 });
  }

  protected refresh(): void {
    this.#silentRefresh(true);
  }

  protected retry(): void {
    const query = this.#tableQuery();
    this.#loadSummary(false);
    this.#loadHistory(false);
    if (query !== null) {
      this.#loadTable(query, false);
    }
  }

  /* ── Presentation helpers ────────────────────────────────────────────────── */

  protected percent(rate: number): string {
    return `${Math.round(rate * 1000) / 10}%`.replace('.', ',');
  }

  protected sedeProgress(metrics: DeskMetrics): number {
    return Math.round(metrics.attendanceRate * 100);
  }

  protected folio(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  protected document(row: DeskRow): string {
    return `${row.documentType} ${formatDocument(row.documentNumber, row.documentType)}`;
  }

  protected companionsNote(count: number): string {
    if (count <= 0) {
      return '';
    }
    return count === 1
      ? this.#i18n.t('desk.row.companionOne')
      : this.#i18n.t('desk.row.companions', { count: count.toLocaleString('es-CO') });
  }

  protected expanded(id: string): boolean {
    return this.expandedId() === id;
  }

  protected expandable(row: DeskRow): boolean {
    return row.companionsCount > 0;
  }

  protected companionPeople(count: number): string {
    return count === 1
      ? this.#i18n.t('desk.companions.person')
      : this.#i18n.t('desk.companions.people', { count: count.toLocaleString('es-CO') });
  }

  protected companionState(id: string): AsyncState<readonly DeskCompanion[]> | null {
    return this.#companions()[id] ?? null;
  }

  protected companionList(id: string): readonly DeskCompanion[] {
    const state = this.#companions()[id];
    return state?.status === 'loaded' ? state.value : [];
  }

  protected companionDocument(companion: DeskCompanion): string {
    if (!companion.documentType || !companion.documentNumber) {
      return '—';
    }
    return `${companion.documentType} ${formatDocument(companion.documentNumber, companion.documentType)}`;
  }

  protected toggleRow(row: DeskRow): void {
    if (this.expandedId() === row.id) {
      this.expandedId.set(null);
      return;
    }
    if (!this.expandable(row)) {
      this.expandedId.set(null);
      return;
    }
    this.expandedId.set(row.id);
    const current = this.#companions()[row.id];
    if (current?.status === 'loaded' || current?.status === 'loading') {
      return;
    }
    this.#companionSubs.get(row.id)?.unsubscribe();
    this.#companions.update((states) => ({ ...states, [row.id]: loadingState() }));
    this.#companionSubs.set(
      row.id,
      this.#api.companions(row.id).subscribe({
        next: (companions) =>
          this.#companions.update((states) => ({ ...states, [row.id]: loadedState(companions) })),
        error: (error: unknown) =>
          this.#companions.update((states) => ({
            ...states,
            [row.id]: errorState(toApiError(error)),
          })),
      }),
    );
  }

  protected turnLabel(row: DeskRow): string {
    const { firstTurn, lastTurn } = row.checkIn;
    if (firstTurn === null) {
      return '—';
    }
    return lastTurn !== null && lastTurn !== firstTurn ? `${firstTurn}–${lastTurn}` : `${firstTurn}`;
  }

  protected time(iso: string | null): string {
    return iso ? this.#format(iso, { hour: 'numeric', minute: '2-digit' }) : '—';
  }

  protected dateTime(iso: string | null): string {
    return iso
      ? this.#format(iso, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
      : '—';
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected eventLabel(event: Event): string {
    return event.status === 'published'
      ? event.name
      : `${event.name} · ${this.#i18n.t(`status.event.${event.status}` as MessageKey)}`;
  }

  /* ── Loading ─────────────────────────────────────────────────────────────── */

  #silentRefresh(force: boolean): void {
    if (this.refreshing() || this.#summaryKey() === null) {
      return;
    }
    this.#loadSummary(true, force);
  }

  #loadSummary(silent: boolean, forceDependents = false): void {
    const eventId = this.eventId();
    if (eventId === null) {
      return;
    }
    this.#subscriptions.summary?.unsubscribe();
    if (silent) {
      this.refreshing.set(true);
    } else {
      this.summary.set(loadingState());
    }
    this.#subscriptions.summary = this.#api.summary(eventId, this.sedeId()).subscribe({
      next: (summary) => {
        const signature = JSON.stringify([summary.totals, summary.sedes]);
        const changed = signature !== this.#signature;
        this.#signature = signature;
        this.summary.set(loadedState(summary));
        this.updatedAt.set(Date.now());
        this.#now.set(Date.now());
        this.refreshFailed.set(false);
        this.refreshing.set(false);
        if (silent && (changed || forceDependents)) {
          const query = this.#tableQuery();
          if (query !== null) {
            this.#loadTable(query, true);
          }
          this.#loadHistory(true);
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

  #loadTable(query: DeskQuery, silent: boolean): void {
    this.#subscriptions.table?.unsubscribe();
    if (!silent) {
      this.table.set(loadingState());
    }
    this.#subscriptions.table = this.#api.registrations(query).subscribe({
      next: (page) => this.table.set(loadedState(page)),
      error: (error: unknown) => {
        if (!(silent && this.table().status === 'loaded')) {
          this.table.set(errorState(toApiError(error)));
        }
      },
    });
  }

  #loadHistory(silent: boolean): void {
    const eventId = this.eventId();
    if (eventId === null) {
      return;
    }
    this.#subscriptions.history?.unsubscribe();
    if (!silent) {
      this.history.set(loadingState());
    }
    this.#subscriptions.history = this.#api
      .registrations({
        eventId,
        participationId: this.sedeId(),
        checkIn: 'checked_in',
        sort: 'checkedInAt',
        order: 'desc',
        limit: HISTORY_SIZE,
        offset: 0,
      })
      .subscribe({
        next: (page) => this.history.set(loadedState(page)),
        error: (error: unknown) => {
          if (!(silent && this.history().status === 'loaded')) {
            this.history.set(errorState(toApiError(error)));
          }
        },
      });
  }

  #applySearch(): void {
    const value = this.term().trim();
    if (value !== this.q()) {
      this.#navigate({ q: value || null, offset: null });
    }
  }

  #kpis(totals: DeskMetrics): readonly Kpi[] {
    const t = (key: MessageKey, params?: Record<string, string | number>): string =>
      this.#i18n.t(key, params);
    const count = (value: number): string => value.toLocaleString('es-CO');
    return [
      {
        id: 'titulares',
        label: 'desk.kpi.titulares',
        icon: 'ticket',
        tone: 'primary',
        value: count(totals.titulares),
        note: t('desk.kpi.titularesNote'),
      },
      {
        id: 'people',
        label: 'desk.kpi.people',
        icon: 'users',
        tone: 'info',
        value: count(totals.people),
        note: t('desk.kpi.peopleNote', { count: count(totals.companions) }),
      },
      {
        id: 'checkedIn',
        label: 'desk.kpi.checkedIn',
        icon: 'log-in',
        tone: 'success',
        value: count(totals.checkedIn),
        note: totals.lastCheckInAt
          ? t('desk.kpi.lastCheckIn', { time: this.time(totals.lastCheckInAt) })
          : t('desk.kpi.noCheckIns'),
      },
      {
        id: 'pending',
        label: 'desk.kpi.pending',
        icon: 'clock',
        tone: 'warning',
        value: count(totals.pending),
        note: t('desk.kpi.pendingNote'),
      },
      {
        id: 'attendance',
        label: 'desk.kpi.attendance',
        icon: 'pie-chart',
        tone: 'accent',
        value: this.percent(totals.attendanceRate),
        note: t('desk.kpi.attendanceNote', {
          checked: count(totals.checkedIn),
          total: count(totals.titulares),
        }),
        progress: Math.round(totals.attendanceRate * 100),
      },
    ];
  }

  #format(iso: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('es-CO', {
      ...options,
      timeZone: this.selectedEvent()?.timezone || 'America/Bogota',
    }).format(new Date(iso));
  }

  protected venueChoices(): readonly SelectChoice[] {
    const summary = this.summaryValue();
    if (!summary) {
      return [];
    }
    return summary.sedes.map((sede) => ({
      value: sede.participationId,
      label: sede.establishment.name,
    }));
  }

  protected async createRegistration(): Promise<void> {
    if (this.createForm.invalid || this.creating()) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    try {
      const value = this.createForm.getRawValue();
      await firstValueFrom(
        this.#registrations.create({
          participationId: value.participationId,
          fullName: value.fullName.trim(),
          documentType: value.documentType,
          documentNumber: value.documentNumber.trim(),
          email: value.email.trim() || null,
          phone: value.phone.trim() || null,
        }),
      );
      this.createForm.reset({
        participationId: value.participationId,
        fullName: '',
        documentType: 'CC',
        documentNumber: '',
        email: '',
        phone: '',
      });
      this.refresh();
    } catch (error: unknown) {
      this.createError.set(this.#errors.message(error));
    } finally {
      this.creating.set(false);
    }
  }

  #navigate(params: Record<string, string | number | null>): void {
    void this.#router.navigate(['/panel/mesa'], {
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(parsed)))
    : fallback;
}
