import { describe, expect, it } from 'vitest';
import { groupNameTaken, sameGroupName } from './collaborators-page';

describe('group names', () => {
  it('treats spacing and case as the same name', () => {
    expect(sameGroupName('  Equipo de registro ', 'equipo de registro')).toBe(true);
    expect(sameGroupName('Cupidos', 'Barby')).toBe(false);
  });

  it('rejects a duplicate and allows the group being edited to keep its name', () => {
    const groups = [
      { id: 'a', name: 'Registro' },
      { id: 'b', name: 'Puerta' },
    ];
    expect(groupNameTaken(' registro ', groups, null)).toBe(true);
    expect(groupNameTaken('Registro', groups, 'a')).toBe(false);
    expect(groupNameTaken('Cocina', groups, null)).toBe(false);
  });
});
