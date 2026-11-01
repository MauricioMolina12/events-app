import { describe, expect, it } from 'vitest';
import type { PublicEvent, PublicParticipation } from '@core/domain';
import { registrationSede } from './participation-availability';

function participation(id: string, open = true): PublicParticipation {
  return {
    id,
    establishment: { id: `${id}-est`, name: id, city: null },
    status: 'active',
    registrationOpen: open,
    availableTitulares: open ? 10 : 0,
    availableCompanions: open ? 10 : 0,
    titularCapacity: 10,
    companionCapacity: 10,
    registrationOpensAt: null,
    registrationClosesAt: null,
  } as PublicParticipation;
}

function event(participations: readonly PublicParticipation[]): PublicEvent {
  return { participations } as PublicEvent;
}

describe('registrationSede', () => {
  it('keeps the sede the person named, even when another one is listed first', () => {
    const barby = participation('barby');
    const cupidos = participation('cupidos');
    expect(registrationSede(event([barby, cupidos]), 'cupidos')?.id).toBe('cupidos');
  });

  it('does not replace a named sede with the first open one when that sede is closed', () => {
    const barby = participation('barby');
    const cupidos = participation('cupidos', false);
    expect(registrationSede(event([barby, cupidos]), 'cupidos')?.id).toBe('cupidos');
  });

  it('uses the only open sede when nobody named one', () => {
    const only = participation('cupidos');
    expect(registrationSede(event([only]))?.id).toBe('cupidos');
  });

  it('leaves the choice open when several sedes can enrol and none was named', () => {
    expect(
      registrationSede(event([participation('barby'), participation('cupidos')])),
    ).toBeUndefined();
  });
});
