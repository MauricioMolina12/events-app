/** Values accepted as query parameters. `null`/`undefined` are dropped. */
export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Readonly<Record<string, QueryValue>>;

/** Removes `null`/`undefined`/empty-string entries so `HttpParams` stays clean. */
export function toHttpParamEntries(params?: QueryParams): readonly (readonly [string, string])[] {
  if (!params) {
    return [];
  }
  const entries: (readonly [string, string])[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      continue;
    }
    entries.push([key, String(value)] as const);
  }
  return entries;
}
