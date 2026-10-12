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
import { catchError, of, switchMap } from 'rxjs';
import type { Page } from '@core/api';
import { ClientsApi } from '@core/clients/clients.api';
import type { PublicEvent } from '@core/domain';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { toZonedDateTimeDisplay } from '@core/utils/dates';
import { ButtonDirective, EmptyState, FormField, Icon, Pagination, Skeleton } from '@shared/ui';
import {
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_PAGE_SIZE,
  CatalogApi,
  type CatalogQuery,
} from '../catalog.api';
import { QuickActions } from '../quick-actions/quick-actions';

/** Page sizes offered by the pager. Every option fits `CATALOG_MAX_PAGE_SIZE`. */
const PAGE_SIZE_OPTIONS: readonly number[] = [12, 24, 48];

const PLACEHOLDER_CARDS: readonly number[] = [1, 2, 3, 4, 5, 6];

/**
 * Public catalog of one client (`/clientes/:clienteSlug/eventos`).
 *
 * `/eventos` is the directory of spaces, not this list. Event detail and
 * registration links stay on `/eventos/:slug` so existing QR links keep working.
 */
@Component({
  selector: 'app-event-list-page',
  imports: [
    TranslatePipe,
    RouterLink,
    ButtonDirective,
    EmptyState,
    FormField,
    Pagination,
    Skeleton,
    Icon,
    QuickActions,
  ],
  templateUrl: './event-list-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventListPage {
  /** Client slug from `/clientes/:clienteSlug/eventos`. */
  readonly clienteSlug = input.required<string>();
  /** Committed term, from `?search=`. */
  readonly search = input('', {
    transform: (value: string | undefined) => value?.trim() ?? '',
  });
  readonly limit = input(CATALOG_PAGE_SIZE, {
    transform: (value: unknown) => clampLimit(toNumber(value, CATALOG_PAGE_SIZE)),
  });
  readonly offset = input(0, {
    transform: (value: unknown) => Math.max(0, toNumber(value, 0)),
  });

  /** What is in the box right now; only the URL commits a term. */
  protected readonly term = signal('');

  readonly #router = inject(Router);
  readonly #api = inject(CatalogApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #directory = toSignal(
    inject(ClientsApi)
      .listPublic()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly clientName = computed(
    () => this.#directory().find((client) => client.slug === this.clienteSlug())?.displayName ?? '',
  );

  /** Bumped by `retry()`. It is part of the request so a retry re-subscribes. */
  readonly #attempt = signal(0);

  readonly #request = computed(() => ({
    query: {
      search: this.search() || undefined,
      limit: this.limit(),
      offset: this.offset(),
    } satisfies CatalogQuery,
    slug: this.clienteSlug(),
    attempt: this.#attempt(),
  }));

  readonly state = toSignal(
    toObservable(this.#request).pipe(
      switchMap(({ query, slug }) => this.#api.listClientEvents(slug, query).pipe(toAsyncState())),
    ),
    { initialValue: loadingState<Page<PublicEvent>>() },
  );

  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  protected readonly placeholders = PLACEHOLDER_CARDS;

  constructor() {
    // Deep links arrive with `?search=`: keep the box in sync with the URL.
    effect(() => {
      this.term.set(this.search());
    });
  }

  protected onTermInput(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    this.apply(this.term());
  }

  protected apply(raw: string): void {
    const trimmed = raw.trim();
    this.term.set(trimmed);
    this.#navigate({ search: trimmed || null, offset: null });
  }

  protected clearSearch(): void {
    this.term.set('');
    this.#navigate({ search: null, offset: null });
  }

  protected onOffsetChange(offset: number): void {
    this.#navigate({ offset });
  }

  protected onLimitChange(limit: number): void {
    this.#navigate({ offset: 0, limit });
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }

  protected readonly error = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.error : null;
  });

  protected readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? this.#errors.message(error) : '';
  });

  protected readonly isOffline = computed(() => {
    const error = this.error();
    return error ? this.#errors.isOffline(error) : false;
  });

  /** Sedes that are taking registrations right now. `0` means the event is closed. */
  protected openCount(event: PublicEvent): number {
    return event.participations.filter((participation) => participation.registrationOpen).length;
  }

  /** Distinct cities of the published sedes, in the order the API returned them. */
  protected cityLabel(event: PublicEvent): string {
    const cities = new Set<string>();
    for (const participation of event.participations) {
      const city = participation.establishment.city;
      if (city) {
        cities.add(city);
      }
    }
    return [...cities].join(' · ');
  }

  /** Schedule in the event's own timezone; empty when the date is still a draft. */
  protected whenLabel(event: PublicEvent): string {
    const startsAt = toZonedDateTimeDisplay(event.startsAt, event.timezone);
    const endsAt = event.endsAt ? toZonedDateTimeDisplay(event.endsAt, event.timezone) : '';
    return endsAt ? `${startsAt} – ${endsAt}` : startsAt;
  }

  #navigate(params: Record<string, string | number | null>): void {
    void this.#router.navigate(['/clientes', this.clienteSlug(), 'eventos'], {
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }
}

/** Query strings are text: anything unparsable falls back to the default. */
function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** The API rejects `limit` above its own maximum, so the client never asks for more. */
function clampLimit(value: number): number {
  return Math.min(CATALOG_MAX_PAGE_SIZE, Math.max(1, Math.trunc(value)));
}
