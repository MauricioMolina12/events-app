import { describe, expect, it } from 'vitest';
import { toHttpParamEntries } from './query-params';

describe('toHttpParamEntries', () => {
  it('returns an empty list when there are no params', () => {
    expect(toHttpParamEntries()).toEqual([]);
    expect(toHttpParamEntries({})).toEqual([]);
  });

  it('drops null, undefined and empty strings', () => {
    const entries = toHttpParamEntries({ q: '', status: null, role: undefined });

    expect(entries).toEqual([]);
  });

  it('keeps falsy-but-meaningful values', () => {
    // `false` and `0` are valid filters/pagination values and must survive.
    expect(toHttpParamEntries({ active: false, offset: 0 })).toEqual([
      ['active', 'false'],
      ['offset', '0'],
    ]);
  });

  it('stringifies every accepted primitive', () => {
    expect(toHttpParamEntries({ limit: 20, q: 'toy', includeClosed: true })).toEqual([
      ['limit', '20'],
      ['q', 'toy'],
      ['includeClosed', 'true'],
    ]);
  });

  it('preserves insertion order so the URL stays stable between renders', () => {
    const entries = toHttpParamEntries({ b: '2', a: '1' });

    expect(entries.map(([key]) => key)).toEqual(['b', 'a']);
  });
});
