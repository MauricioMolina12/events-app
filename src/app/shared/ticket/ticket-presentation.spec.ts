import { describe, expect, it } from 'vitest';
import { ticketEventTitle, ticketVenueLabel } from './ticket-presentation';

describe('ticketEventTitle', () => {
  it('uses the event name and refuses a blank substitute', () => {
    expect(ticketEventTitle('  Gran madrugón 2026  ')).toBe('Gran madrugón 2026');
    expect(ticketEventTitle('')).toBeNull();
    expect(ticketEventTitle(null)).toBeNull();
    expect(ticketEventTitle('   ')).toBeNull();
  });
});

describe('ticketVenueLabel', () => {
  it('names every sede when the inscription covers the whole event', () => {
    expect(
      ticketVenueLabel({
        scope: 'all_venues',
        allVenuesLabel: 'Todas las sucursales',
        establishmentName: 'Barby Toys',
        establishmentCity: 'Bogotá',
      }),
    ).toBe('Todas las sucursales');
  });

  it('keeps the chosen sede when the inscription belongs to one venue', () => {
    expect(
      ticketVenueLabel({
        scope: 'per_venue',
        allVenuesLabel: 'Todas las sucursales',
        establishmentName: 'Barby Toys',
        establishmentCity: 'Bogotá',
      }),
    ).toBe('Barby Toys · Bogotá');
    expect(
      ticketVenueLabel({
        scope: 'per_venue',
        allVenuesLabel: 'Todas las sucursales',
        establishmentName: 'Barby Toys',
        establishmentCity: null,
      }),
    ).toBe('Barby Toys');
  });
});
