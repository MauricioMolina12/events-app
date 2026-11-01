import type { RegistrationScope } from '@core/domain';

/**
 * The large title on a ticket is the event name.
 * The access-code kicker stays a kicker: it is never a substitute for a missing name.
 */
export function ticketEventTitle(eventName: string | null | undefined): string | null {
  const name = eventName?.trim() ?? '';
  return name.length > 0 ? name : null;
}

/**
 * Venue line printed on the ticket.
 * `all_venues` is one registration for every sede, so the line does not name a single one.
 */
export function ticketVenueLabel(input: {
  readonly scope?: RegistrationScope | null;
  readonly allVenuesLabel: string;
  readonly establishmentName?: string | null;
  readonly establishmentCity?: string | null;
}): string | null {
  if (input.scope === 'all_venues') {
    const label = input.allVenuesLabel.trim();
    return label.length > 0 ? label : null;
  }
  const name = input.establishmentName?.trim() ?? '';
  if (name.length === 0) {
    return null;
  }
  const city = input.establishmentCity?.trim() ?? '';
  return city.length > 0 ? `${name} · ${city}` : name;
}
