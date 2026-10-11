import { catchError, map, of, startWith, type Observable, type OperatorFunction } from 'rxjs';
import { toApiError, type ApiError } from '@core/api/api-error';

/**
 * Minimal async-state machine for read screens.
 *
 * Every list/detail page has the same three visual states, so they are modelled once
 * here instead of each component inventing its own booleans. The union makes
 * "loaded but no value" unrepresentable.
 */
export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: T }
  | { readonly status: 'error'; readonly error: ApiError };

export function loadingState<T>(): AsyncState<T> {
  return { status: 'loading' };
}

export function loadedState<T>(value: T): AsyncState<T> {
  return { status: 'loaded', value };
}

export function errorState<T>(error: ApiError): AsyncState<T> {
  return { status: 'error', error };
}

/**
 * Wraps a one-shot read into the state machine: emits `loading` immediately, then a
 * single `loaded` or `error`. Never re-throws, so `toSignal` consumers always have a
 * renderable value.
 */
export function toAsyncState<T>(): OperatorFunction<T, AsyncState<T>> {
  return (source: Observable<T>) =>
    source.pipe(
      map((value) => loadedState(value)),
      startWith<AsyncState<T>>({ status: 'loading' }),
      catchError((error: unknown) => of(errorState<T>(toApiError(error)))),
    );
}
