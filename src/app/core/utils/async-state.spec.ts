import { firstValueFrom, of, throwError, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { NETWORK_ERROR_CODE } from '../api/envelope';
import {
  errorState,
  loadedState,
  loadingState,
  toAsyncState,
  type AsyncState,
} from './async-state';

describe('async-state factories', () => {
  it('builds an unrepresentable-free union member per state', () => {
    expect(loadingState<string>()).toEqual({ status: 'loading' });
    expect(loadedState('ready')).toEqual({ status: 'loaded', value: 'ready' });
    expect(errorState<string>({ code: 'INTERNAL_ERROR' } as never)).toMatchObject({
      status: 'error',
    });
  });
});

describe('toAsyncState', () => {
  it('emits loading before the loaded value', async () => {
    const states = await firstValueFrom(of('payload').pipe(toAsyncState(), toArray()));

    expect(states).toEqual([{ status: 'loading' }, { status: 'loaded', value: 'payload' }]);
  });

  it('emits exactly two states and completes (no re-emission on repeat)', async () => {
    const states = await firstValueFrom(of(1).pipe(toAsyncState(), toArray()));

    expect(states).toHaveLength(2);
    expect(states.at(-1)?.status).toBe('loaded');
  });

  it('turns a failure into an error state instead of re-throwing', async () => {
    const states = await firstValueFrom(
      throwError(() => new Error('sin red')).pipe(toAsyncState(), toArray()),
    );

    const last = states.at(-1) as AsyncState<never>;
    expect(last.status).toBe('error');
    // `toApiError` normalizes anything thrown into an `ApiError`; a plain `Error`
    // never reached the API, so it is reported as a network failure.
    expect(last.status === 'error' && last.error.code).toBe(NETWORK_ERROR_CODE);
    expect(last.status === 'error' && last.error.message).toBe('sin red');
  });
});
