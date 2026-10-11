/**
 * Date helpers. Rule of the house: **the wire is always ISO-8601 UTC**, the
 * display is always in the timezone of the resource.
 *
 * `Date` objects never enter the API models; they only appear inside these
 * helpers where an explicit conversion is unavoidable.
 */

/** Renders an ISO instant in the given timezone. Empty string for `null`. */
export function toZonedDisplay(
  iso: string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('es-CO', {
    timeZone,
    dateStyle: 'medium',
    ...options,
  });
  return formatter.format(date);
}

/** Renders an ISO instant with date + time in the given timezone. */
export function toZonedDateTimeDisplay(
  iso: string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toZonedDisplay(iso, timeZone, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  });
}

/** `datetime-local` value (e.g. `2026-04-25T10:00`) → ISO UTC string. */
export function localInputToUtcIso(localValue: string, timeZone: string): string {
  const parts = parseLocalInput(localValue);
  if (!parts) {
    return '';
  }
  // Interpret the wall-clock value as if it lived in `timeZone`, then read the
  // corresponding UTC instant by diffing the two renderings of the same moment.
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  const offsetMs = timeZoneOffsetMs(new Date(asUtc), timeZone);
  return new Date(asUtc - offsetMs).toISOString();
}

/** ISO UTC string → `datetime-local` value **in the resource timezone**. */
export function utcIsoToLocalInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Human sentence for an effective registration window. The caller is responsible
 * for passing the **effective** window (participation values already resolved by
 * the server, falling back to the event window).
 */
export function describeWindow(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  timeZone: string,
): string {
  if (!opensAt && !closesAt) {
    return 'Sin ventana definida';
  }
  if (opensAt && closesAt) {
    return `Del ${toZonedDisplay(opensAt, timeZone)} al ${toZonedDisplay(closesAt, timeZone)}`;
  }
  if (opensAt) {
    return `Desde el ${toZonedDisplay(opensAt, timeZone)}`;
  }
  return `Hasta el ${toZonedDisplay(closesAt ?? '', timeZone)}`;
}

/** Whether `now` falls inside a window expressed in UTC (`null` = open end). */
export function isWithinWindow(
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (opensAt && now.getTime() < new Date(opensAt).getTime()) {
    return false;
  }
  if (closesAt && now.getTime() > new Date(closesAt).getTime()) {
    return false;
  }
  return true;
}

interface LocalInputParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

function parseLocalInput(value: string): LocalInputParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute] = match;
  if (!year || !month || !day || !hour || !minute) {
    return null;
  }
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

/** Offset in ms between `timeZone` and UTC for a given instant. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}
