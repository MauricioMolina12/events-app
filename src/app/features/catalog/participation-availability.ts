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
 * The requested sede when it can take an alta, else the first one that can. The fallback keeps
 * a stale selection working; only when nothing is usable does it return a blocked sede, so the
 * form has something to explain instead of an empty screen.
 */
export function pickSede(
  event: PublicEvent,
  requestedId?: string | undefined,
): PublicParticipation | undefined {
  const requested = requestedId
    ? event.participations.find((participation) => participation.id === requestedId)
    : undefined;
  if (requested && isRegistrable(requested)) {
    return requested;
  }
  return registrableSedes(event)[0] ?? event.participations[0];
}

/** Badge kind for a sede: `open` is the only state that reads as available. */
export function participationStatusKind(participation: PublicParticipation): StatusKind {
  return participation.registrationOpen ? 'participation.open' : 'participation.closed';
}
