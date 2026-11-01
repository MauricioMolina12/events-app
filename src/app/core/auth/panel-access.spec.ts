import { describe, expect, it } from 'vitest';
import { allowsPanelPath, landingPath, panelHome } from './panel-access';

describe('panelHome', () => {
  it('keeps a full account on the dashboard', () => {
    expect(panelHome(undefined)).toBe('/panel');
    expect(panelHome([])).toBe('/panel');
    expect(panelHome(['dashboard', 'ingreso'])).toBe('/panel');
  });

  it('sends an ingresos-only account to check-in', () => {
    expect(panelHome(['ingreso'])).toBe('/panel/ingreso');
  });

  it('picks the first section the account can open', () => {
    expect(panelHome(['eventos', 'sedes'])).toBe('/panel/eventos');
  });
});

describe('landingPath', () => {
  it('honors a remembered path the account can open', () => {
    expect(landingPath(['ingreso'], '/panel/ingreso')).toBe('/panel/ingreso');
  });

  it('replaces the dashboard when the account cannot open it', () => {
    expect(landingPath(['ingreso'], '/panel')).toBe('/panel/ingreso');
    expect(landingPath(['ingreso'], '/panel/eventos/nuevo')).toBe('/panel/ingreso');
  });

  it('keeps the remembered path for an unrestricted account', () => {
    expect(landingPath(undefined, '/panel/cupos?evento=1')).toBe('/panel/cupos?evento=1');
    expect(allowsPanelPath('/panel/mesa', [])).toBe(true);
  });

  it('does not treat other panel sections as open for a restricted account', () => {
    expect(allowsPanelPath('/panel/usuarios', ['ingreso'])).toBe(false);
    expect(allowsPanelPath('/panel/mesa', ['ingreso'])).toBe(false);
  });
});
