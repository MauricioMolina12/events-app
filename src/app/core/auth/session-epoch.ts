import { HttpContextToken } from '@angular/common/http';

/** Marca con qué sesión salió cada petición. */
export const SESSION_EPOCH = new HttpContextToken<number>(() => 0);

let epoch = 0;

export function currentSessionEpoch(): number {
  return epoch;
}

/**
 * El login invalida las peticiones anteriores. Un `/auth/me` que salió sin
 * cookie y responde 401 después no debe borrar la sesión recién abierta.
 */
export function bumpSessionEpoch(): void {
  epoch += 1;
}
