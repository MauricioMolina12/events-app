import { describe, expect, it } from 'vitest';
import { isPanelTabActive, panelSectionTitle } from './panel-shell';

describe('panelSectionTitle', () => {
  it('maps nested panel routes to the section heading', () => {
    expect(panelSectionTitle('/panel')).toBe('nav.panel.dashboard');
    expect(panelSectionTitle('/panel/mesa?evento=1')).toBe('nav.panel.registrations');
    expect(panelSectionTitle('/panel/ingreso')).toBe('nav.panel.checkIn');
    expect(panelSectionTitle('/panel/eventos/nuevo')).toBe('events.form.create');
    expect(panelSectionTitle('/panel/eventos/abc/editar')).toBe('events.form.edit');
    expect(panelSectionTitle('/panel/sedes')).toBe('nav.panel.establishments');
    expect(panelSectionTitle('/panel/configuracion')).toBe('nav.panel.settings');
    expect(panelSectionTitle('/panel/colaboradores')).toBe('collaborators.title');
  });
});

describe('isPanelTabActive', () => {
  it('keeps the dashboard tab exact and the others prefix-aware', () => {
    expect(isPanelTabActive('/panel', '/panel')).toBe(true);
    expect(isPanelTabActive('/panel/mesa', '/panel')).toBe(false);
    expect(isPanelTabActive('/panel/eventos/nuevo', '/panel/eventos')).toBe(true);
  });
});
