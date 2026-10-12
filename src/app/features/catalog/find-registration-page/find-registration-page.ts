import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, switchMap } from 'rxjs';
import type { PublicEvent, PublicRegistrationReceipt } from '@core/domain';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { ButtonDirective, EmptyState, PageHeader, Select, type SelectChoice } from '@shared/ui';
import { CatalogApi } from '../catalog.api';

@Component({
  selector: 'app-find-registration-page',
  imports: [TranslatePipe, RouterLink, ButtonDirective, EmptyState, PageHeader, Select],
  templateUrl: './find-registration-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindRegistrationPage {
  readonly slug = input<string | undefined>(undefined);
  readonly clienteSlug = input<string | undefined>(undefined);

  readonly #api = inject(CatalogApi);
  readonly #errors = inject(ApiErrorPresenter);

  protected readonly query = signal('');
  protected readonly selectedSlug = signal('');
  protected readonly searching = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly results = signal<readonly PublicRegistrationReceipt[]>([]);

  readonly events = toSignal(
    toObservable(computed(() => this.clienteSlug()?.trim() ?? '')).pipe(
      switchMap((client) =>
        (client
          ? this.#api.listClientEvents(client, { limit: 50 })
          : this.#api.listEvents({ limit: 50 })
        ).pipe(
          map((page) => page.items),
          catchError(() => of<readonly PublicEvent[]>([])),
        ),
      ),
    ),
    { initialValue: [] as readonly PublicEvent[] },
  );

  protected readonly eventChoices = computed<readonly SelectChoice[]>(() =>
    this.events().map((event) => ({ value: event.slug, label: event.name })),
  );

  protected readonly eventSlug = computed(() => this.slug()?.trim() || this.selectedSlug());

  protected async search(): Promise<void> {
    const event = this.eventSlug();
    const query = this.query().trim();
    if (!event || query.length < 2 || this.searching()) {
      return;
    }
    this.searching.set(true);
    this.errorMessage.set('');
    try {
      const hits = await firstValueFrom(this.#api.searchRegistrations(event, query));
      this.results.set(hits);
    } catch (error: unknown) {
      this.results.set([]);
      this.errorMessage.set(this.#errors.message(error));
    } finally {
      this.searching.set(false);
    }
  }
}
