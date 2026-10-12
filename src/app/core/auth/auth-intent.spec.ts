import { afterEach, describe, expect, it } from 'vitest';
import { AuthIntent } from './auth-intent';

describe('AuthIntent', () => {
  afterEach(() => {
    history.replaceState({}, '');
  });

  it('prefers the path recorded during this page load', () => {
    history.replaceState({ continueTo: '/panel/mesa' }, '');
    const store = new AuthIntent();
    store.remember('/panel/cupos');
    expect(store.peek()).toBe('/panel/cupos');
  });

  it('restores an internal path from the login history entry', () => {
    history.replaceState({ navigationId: 3, continueTo: '/panel/cupos?evento=1' }, '');
    expect(new AuthIntent().peek()).toBe('/panel/cupos?evento=1');
  });

  it('ignores an external url planted in history and falls back to the panel', () => {
    history.replaceState({ continueTo: 'https://evil.test/steal' }, '');
    const store = new AuthIntent();
    store.remember('//evil.test');
    expect(store.peek()).toBe('/panel');
  });

  it('clears the destination without dropping the router navigation id', () => {
    history.replaceState({ navigationId: 4, continueTo: '/panel/cupos' }, '');
    const store = new AuthIntent();
    store.remember('/panel/cupos');
    store.clear();
    expect(history.state.continueTo).toBeUndefined();
    expect(history.state.navigationId).toBe(4);
    expect(store.peek()).toBe('/panel');
  });
});
