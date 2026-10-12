import type { Participation } from '@core/domain';

/**
 * Presentation thresholds for the cupos dashboard.
 *
 * They only choose a label and a colour. A sede is "llena" exclusively when
 * the API reports no remaining titular seats and no remaining companion seats.
 * Availability itself stays `availableTitulares` / `availableCompanions`.
 */
export const OCCUPANCY_THRESHOLDS = {
  high: 0.7,
  critical: 0.9,
} as const;

export type OccupancyLevel = 'normal' | 'high' | 'critical' | 'full' | 'unassigned' | 'cancelled';

export interface VenueSnapshot {
  readonly id: string;
  readonly establishmentId: string;
  readonly name: string;
  readonly city: string | null;
  readonly status: Participation['status'];
  readonly titularCapacity: number;
  readonly companionCapacity: number;
  readonly confirmedTitulares: number;
  readonly confirmedCompanions: number;
  readonly availableTitulares: number;
  readonly availableCompanions: number;
  readonly capacity: number;
  readonly occupied: number;
  readonly available: number;
  readonly percent: number;
  readonly level: OccupancyLevel;
}

export interface OccupancySummary {
  readonly capacity: number;
  readonly occupied: number;
  readonly available: number;
  readonly registrations: number;
  readonly percent: number;
  readonly busiest: VenueSnapshot | null;
  readonly criticalCount: number;
  readonly fullCount: number;
}

const countFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatPercent(value: number): string {
  return `${percentFormat.format(value)} %`;
}

/**
 * People in the sede versus seats assigned to it.
 *
 * `available` is the sum of the API fields, not `capacity - occupied`. When the
 * API still has seats, the shown percent stays under 100 so a rounding does
 * not read as "llena".
 */
export function occupancyPercent(occupied: number, capacity: number, available: number): number {
  if (capacity <= 0 || occupied <= 0) {
    return 0;
  }
  if (available <= 0) {
    return 100;
  }
  const rounded = Math.round((occupied / capacity) * 1000) / 10;
  return Math.min(99.9, rounded);
}

export function occupancyLevel(
  capacity: number,
  available: number,
  occupied: number,
): OccupancyLevel {
  if (capacity <= 0) {
    return 'unassigned';
  }
  if (available <= 0) {
    return 'full';
  }
  const ratio = occupied / capacity;
  if (ratio >= OCCUPANCY_THRESHOLDS.critical) {
    return 'critical';
  }
  if (ratio >= OCCUPANCY_THRESHOLDS.high) {
    return 'high';
  }
  return 'normal';
}

export function venueSnapshot(participation: Participation): VenueSnapshot {
  const capacity = participation.titularCapacity + participation.companionCapacity;
  const occupied = participation.confirmedTitulares + participation.confirmedCompanions;
  const available = participation.availableTitulares + participation.availableCompanions;
  const level: OccupancyLevel =
    participation.status === 'cancelled'
      ? 'cancelled'
      : occupancyLevel(capacity, available, occupied);
  return {
    id: participation.id,
    establishmentId: participation.establishmentId,
    name: participation.establishment.name,
    city: participation.establishment.city,
    status: participation.status,
    titularCapacity: participation.titularCapacity,
    companionCapacity: participation.companionCapacity,
    confirmedTitulares: participation.confirmedTitulares,
    confirmedCompanions: participation.confirmedCompanions,
    availableTitulares: participation.availableTitulares,
    availableCompanions: participation.availableCompanions,
    capacity,
    occupied,
    available,
    percent: occupancyPercent(occupied, capacity, available),
    level,
  };
}

/** Totals for sedes that still count. Cancelled participations are omitted by the caller. */
export function summarizeVenues(venues: readonly VenueSnapshot[]): OccupancySummary {
  const capacity = venues.reduce((total, venue) => total + venue.capacity, 0);
  const occupied = venues.reduce((total, venue) => total + venue.occupied, 0);
  const available = venues.reduce((total, venue) => total + venue.available, 0);
  const registrations = venues.reduce((total, venue) => total + venue.confirmedTitulares, 0);
  const ranked = venues
    .filter((venue) => venue.capacity > 0)
    .slice()
    .sort((left, right) => right.percent - left.percent || right.occupied - left.occupied);
  return {
    capacity,
    occupied,
    available,
    registrations,
    percent: occupancyPercent(occupied, capacity, available),
    busiest: ranked[0] ?? null,
    criticalCount: venues.filter((venue) => venue.level === 'critical').length,
    fullCount: venues.filter((venue) => venue.level === 'full').length,
  };
}
