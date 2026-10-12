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
import type { Establishment, EstablishmentStatus } from '@core/domain';
import { I18nService, TranslatePipe, type MessageKey } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import {
  ButtonDirective,
  EmptyState,
  Icon,
  PageHeader,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  type SelectChoice,
  type StatusKind,
} from '@shared/ui';
import {
  ESTABLISHMENT_MAX_PAGE_SIZE,
  ESTABLISHMENT_PAGE_SIZE,
  EstablishmentsApi,
  type EstablishmentListQuery,
} from '../establishments.api';
import { ESTABLISHMENT_STATUSES, isEstablishmentStatus } from '../establishment-status';

const PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100];
const SKELETON_ROWS: readonly number[] = [1, 2, 3, 4, 5];

@Component({
  selector: 'app-establishment-list-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonDirective,
    EmptyState,
    Icon,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
    StatusBadge,
  ],
  templateUrl: './establishment-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentListPage {
  readonly search = input('', { transform: (value: string | undefined) => value?.trim() ?? '' });
  readonly status = input('', { transform: (value: string | undefined) => value ?? '' });
  readonly limit = input(ESTABLISHMENT_PAGE_SIZE, {
    transform: (value: unknown) => clampNumber(value, ESTABLISHMENT_PAGE_SIZE, 1, ESTABLISHMENT_MAX_PAGE_SIZE),
  });
  readonly offset = input(0, {
    transform: (value: unknown) => clampNumber(value, 0, 0, Number.MAX_SAFE_INTEGER),
  });

  protected readonly term = signal('');
  protected readonly statuses = ESTABLISHMENT_STATUSES;
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly placeholders = SKELETON_ROWS;

  readonly #router = inject(Router);
  readonly #api = inject(EstablishmentsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #i18n = inject(I18nService);
  readonly #session = inject(SessionStore);
  protected readonly canCreate = computed(() => this.#session.isAuthenticated());
  protected readonly canEdit = computed(
    () => this.#session.isAdmin() || this.#session.role() === 'operator',
  );
  readonly #attempt = signal(0);
  readonly #request = computed(() => ({
    query: {
      search: this.search() || undefined,
      status: isEstablishmentStatus(this.status())
        ? (this.status() as EstablishmentStatus)
        : undefined,
      limit: this.limit(),
      offset: this.offset(),
    } satisfies EstablishmentListQuery,
    attempt: this.#attempt(),
  }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ query }) => this.#api.list(query).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<Page<Establishment>>() },
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
    { value: '', label: this.#i18n.t('establishments.filter.all') },
    ...this.statuses.map((item) => ({ value: item, label: this.statusLabel(item) })),
  ]);

  protected applyStatus(value: string): void {
    this.#navigate({ status: isEstablishmentStatus(value) ? value : null, offset: null });
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

  protected statusKind(status: EstablishmentStatus): StatusKind {
    return `establishment.${status}`;
  }

  protected statusLabel(status: EstablishmentStatus): string {
    return this.#i18n.t(`status.establishment.${status}` as MessageKey);
  }

  #navigate(params: Record<string, string | number | null>): void {
    void this.#router.navigate(['/panel/sedes'], {
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
