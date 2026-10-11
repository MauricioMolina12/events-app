import type { EstablishmentStatus } from '@core/domain';

export const ESTABLISHMENT_STATUSES: readonly EstablishmentStatus[] = ['active', 'inactive'];

export function isEstablishmentStatus(value: string): value is EstablishmentStatus {
  return ESTABLISHMENT_STATUSES.includes(value as EstablishmentStatus);
}
