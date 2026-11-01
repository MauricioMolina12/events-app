import type { PublicEvent, PublicParticipation } from '@core/domain';
import type { MessageKey } from '@core/i18n';
import { isWithinWindow } from '@core/utils/dates';
import type { StatusKind } from '@shared/ui';

/**
 * Who may still take a registration, in one place.
 *
 * Three screens ask the same question — the event detail, the form's sede picker and the
 * public `/inscripcion` gate — and they must answer it identically: the card that offers the
 * alta and the screen that refuses it are read as one flow, so a disagreement between them
 * looks like a bug in the app. The rules are the API's (`registrationOpen`, `available*` are
 * computed server-side); nothing here re-derives them from scratch.
 */

/**
 * Why a sede cannot take a registration, in the order the alta would reject it.
 * `undefined` means the CTA is live.
 */
export function registrableReason(participation: PublicParticipation): MessageKey | undefined {
  if (!isWithinWindow(participation.registrationOpensAt, participation.registrationClosesAt)) {
    return 'event.venue.outsideWindow';
  }
  if (participation.availableTitulares <= 0) {
    return 'ui.capacity.full';
  }
  if (!participation.registrationOpen) {
    return 'event.venue.closedParticipation';
  }
  return undefined;
}

/**
 * Why a sede cannot take more companions for an existing alta. A full titular quota does not
 * matter here: the titular already holds a seat, only the companion seats are spent.
 */
export function companionReason(participation: PublicParticipation): MessageKey | undefined {
  if (!isWithinWindow(participation.registrationOpensAt, participation.registrationClosesAt)) {
    return 'event.venue.outsideWindow';
  }
  if (!participation.registrationOpen) {
    return 'event.venue.closedParticipation';
  }
  if (participation.availableCompanions <= 0) {
    return 'companions.noSeats';
  }
  return undefined;
}

/** A sede the alta would accept right now. */
export function isRegistrable(participation: PublicParticipation): boolean {
  return registrableReason(participation) === undefined;
}

/** Sedes that can take an alta right now, in the order the API returned them. */
export function registrableSedes(event: PublicEvent): readonly PublicParticipation[] {
  return event.participations.filter(isRegistrable);
}

/**
 * The sede an alta is stored against.
 *
 * A sede the person named (the card they opened, or the one they picked) is used as-is.
 * The only automatic choice is a event with a single open sede. Several open sedes and no
 * choice stay unresolved, so the form cannot silently enrol them in whichever sede the API
 * listed first.
 */
export function registrationSede(
  event: PublicEvent,
  requestedId?: string | undefined,
): PublicParticipation | undefined {
  if (requestedId) {
    const named = event.participations.find((participation) => participation.id === requestedId);
    if (named) {
      return named;
    }
  }
  const open = registrableSedes(event);
  return open.length === 1 ? open[0] : undefined;
}

/** Badge kind for a sede: `open` is the only state that reads as available. */
export function participationStatusKind(participation: PublicParticipation): StatusKind {
  return participation.registrationOpen ? 'participation.open' : 'participation.closed';
}
