import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@core/auth';
import { canManageEvent } from './event-access';

const operator: AuthUser = {
  id: 'op-1',
  email: 'op@example.com',
  fullName: 'Operador',
  role: 'operator',
  status: 'active',
};

const admin: AuthUser = { ...operator, id: 'admin-1', role: 'admin' };

describe('canManageEvent', () => {
  it('lets an operator edit the event they created', () => {
    expect(canManageEvent(operator, { createdBy: 'op-1' })).toBe(true);
    expect(canManageEvent(operator, { createdBy: 'other' })).toBe(false);
  });

  it('lets an admin edit any event', () => {
    expect(canManageEvent(admin, { createdBy: 'op-1' })).toBe(true);
    expect(canManageEvent(admin, { createdBy: null })).toBe(true);
  });
});
