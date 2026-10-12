import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Page } from '@core/api';
import type { Event as ManagedEvent } from '@core/domain';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { EventInvite, PageHeader, Select, Skeleton, type SelectChoice } from '@shared/ui';
import { EventParticipations } from '../../events/event-participations/event-participations';
import { EventsApi } from '../../events/events.api';
import { pickRelevantEvent } from '../pick-relevant-event';

@Component({
  selector: 'app-quotas-page',
  imports: [TranslatePipe, EventInvite, PageHeader, Select, Skeleton, EventParticipations],
  templateUrl: './quotas-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotasPage {
  /** Set from `/panel/cupos?evento=` when the dashboard opens a specific event. */
  readonly evento = input<string | undefined>(undefined);

  readonly #errors = inject(ApiErrorPresenter);
  readonly #events = inject(EventsApi);

  protected readonly eventId = signal('');
  #appliedContext = false;

  readonly state = toSignal(this.#events.list({ limit: 100 }).pipe(toAsyncState()), {
    initialValue: loadingState<Page<ManagedEvent>>(),
  });

  constructor() {
    effect(() => {
      const state = this.state();
      if (state.status !== 'loaded' || this.#appliedContext) {
        return;
      }
      this.#appliedContext = true;
      const items = state.value.items;
      const requested = this.evento();
      if (requested && items.some((event) => event.id === requested)) {
        this.eventId.set(requested);
        return;
      }
      const picked = pickRelevantEvent(items);
      if (picked) {
        this.eventId.set(picked.id);
      }
    });
  }

  protected readonly choices = computed<readonly SelectChoice[]>(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return [];
    }
    return state.value.items.map((event) => ({ value: event.id, label: event.name }));
  });

  protected readonly selected = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return null;
    }
    return state.value.items.find((event) => event.id === this.eventId()) ?? null;
  });

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });

  protected choose(value: string): void {
    this.eventId.set(value);
  }
}
