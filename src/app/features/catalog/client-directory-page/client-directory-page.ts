import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { ClientsApi, type ClientSpace } from '@core/clients/clients.api';
import { TranslatePipe } from '@core/i18n';
import { ApiErrorPresenter } from '@core/ui';
import { loadingState, toAsyncState } from '@core/utils/async-state';
import { brandInitials } from '@core/workspace/brand-color';
import { EmptyState, Icon, Skeleton } from '@shared/ui';

@Component({
  selector: 'app-client-directory-page',
  imports: [RouterLink, TranslatePipe, EmptyState, Icon, Skeleton],
  templateUrl: './client-directory-page.html',
  styleUrl: './client-directory-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDirectoryPage {
  readonly search = input('', {
    transform: (value: string | undefined) => value?.trim() ?? '',
  });

  readonly #api = inject(ClientsApi);
  readonly #errors = inject(ApiErrorPresenter);
  readonly #attempt = signal(0);
  readonly #request = computed(() => this.#attempt());

  readonly state = toSignal(
    toObservable(this.#request).pipe(switchMap(() => this.#api.listPublic().pipe(toAsyncState()))),
    { initialValue: loadingState<readonly ClientSpace[]>() },
  );

  protected readonly visible = computed(() => {
    const state = this.state();
    if (state.status !== 'loaded') {
      return [];
    }
    const term = this.search().toLocaleLowerCase('es');
    if (!term) {
      return state.value;
    }
    return state.value.filter((client) => client.displayName.toLocaleLowerCase('es').includes(term));
  });

  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? this.#errors.message(state.error) : '';
  });

  protected initials(name: string): string {
    return brandInitials(name);
  }

  protected retry(): void {
    this.#attempt.update((value) => value + 1);
  }
}
