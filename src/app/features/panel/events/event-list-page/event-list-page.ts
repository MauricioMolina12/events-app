import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { SessionStore } from '@core/auth';
import type { Page } from '@core/api';
import type { Event as ManagedEvent, EventStatus } from '@core/domain';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { toZonedDateTimeDisplay } from '@core/utils/dates';
import {
  ButtonDirective,
  EmptyState,
  EventInvite,
  Icon,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  type SelectChoice,
  type StatusKind,
} from '@shared/ui';
import { canManageEvent } from '../event-access';
import {
  EVENT_MAX_PAGE_SIZE,
  EVENT_PAGE_SIZE,
  EventsApi,
  type EventListQuery,
} from '../events.api';
import { EVENT_STATUSES, isEventStatus } from '../event-status';

const PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100];
const SKELETON_ROWS: readonly number[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-event-list-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonDirective,
    EmptyState,
    EventInvite,
    Icon,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './event-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventListPage {
  readonly search = input('', { transform: (value: string | undefined) => value?.trim() ?? '' });
  readonly status = input('', { transform: (value: string | undefined) => value ?? '' });
  readonly limit = input(EVENT_PAGE_SIZE, {
    transform: (value: unknown) => clampNumber(value, EVENT_PAGE_SIZE, 1, EVENT_MAX_PAGE_SIZE),
  });
  readonly offset = input(0, {
    transform: (value: unknown) => clampNumber(value, 0, 0, Number.MAX_SAFE_INTEGER),
  });

  protected readonly term = signal('');
  protected readonly statuses = EVENT_STATUSES;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly placeholders = SKELETON_ROWS;

  readonly #router = inject(Router);
  readonly #api = inject(EventsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #session = inject(SessionStore);
  protected readonly canCreate = computed(() => this.#session.isAdmin());
  protected readonly isAdmin = this.#session.isAdmin;
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({
    query: {
      search: this.search() || undefined,
      status: isEventStatus(this.status()) ? (this.status() as EventStatus) : undefined,
      limit: this.limit(),
      offset: this.offset(),
    } satisfies EventListQuery,
    attempt: this.#attempt(),
  }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ query }) => this.#api.list(query).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<Page<ManagedEvent>>() },
  );

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });
  protected readonly page = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.value : null;
  });

  constructor() {
    effect(() => this.term.set(this.search()));
  }

  protected onTermInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.#navigate({ search: this.term().trim() || null, offset: null });
  }

  protected readonly statusChoices = computed<readonly SelectChoice[]>(() => [
    { value: '', label: this.#i18n.t('events.filter.all') },
    ...this.statuses.map((item) => ({ value: item, label: this.statusLabel(item) })),
  ]);

  protected applyStatus(value: string): void {
    this.#navigate({ status: isEventStatus(value) ? value : null, offset: null });
  }

  protected onOffsetChange(offset: number): void {
    this.#navigate({ offset });
  }

  protected onLimitChange(limit: number): void {
    this.#navigate({ limit, offset: 0 });
  }

  protected retry(): void {
    this.#attempt.update((attempt) => attempt + 1);
  }

  protected eventDate(event: ManagedEvent): string {
    return event.startsAt
      ? toZonedDateTimeDisplay(event.startsAt, event.timezone)
      : this.#i18n.t('events.noDate');
  }

  protected statusKind(status: EventStatus): StatusKind {
    return `event.${status}`;
  }

  protected canEdit(event: ManagedEvent): boolean {
    return canManageEvent(this.#session.user(), event);
  }

  protected statusLabel(status: EventStatus): string {
    return this.#i18n.t(`status.event.${status}` as MessageKey);
  }

  #navigate(params: Record<string, string | number | null>): void {
    void this.#router.navigate(['/panel/eventos'], {
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
