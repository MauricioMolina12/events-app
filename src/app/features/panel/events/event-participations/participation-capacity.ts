/** Whole seats a venue may take from the event's remaining capacity. */
export function seatCount(value: unknown): number | null {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^(?:0|[1-9]\d*)$/.test(text)) {
      return null;
    }
    value = Number(text);
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) {
    return null;
  }
  return value;
}

export interface VenueQuotaInput {
  readonly eventCapacity: number;
  readonly alreadyAllocated: number;
  readonly titularCapacity: number;
  readonly companionCapacity: number;
}

export interface VenueQuotaOverflow {
  readonly remaining: number;
  readonly titularCapacity: number;
  readonly companionCapacity: number;
  readonly requested: number;
}

/**
 * Titulares and acompañantes are both drawn from the seats the event still has free.
 * Either pool, and the two together, must fit in that remainder.
 */
export function venueQuotaOverflow(input: VenueQuotaInput): VenueQuotaOverflow | null {
  const remaining = input.eventCapacity - input.alreadyAllocated;
  const requested = input.titularCapacity + input.companionCapacity;
  if (
    input.titularCapacity <= remaining &&
    input.companionCapacity <= remaining &&
    requested <= remaining
  ) {
    return null;
  }
  return {
    remaining: Math.max(0, remaining),
    titularCapacity: input.titularCapacity,
    companionCapacity: input.companionCapacity,
    requested,
  };
}
