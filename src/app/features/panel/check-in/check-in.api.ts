import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';
import type { DocumentType, RegistrationStatus } from '@core/domain';

export type TurnRole = 'holder' | 'companion';

export interface Turn {
  readonly number: number;
  readonly position: number;
  readonly role: TurnRole;
  readonly fullName: string;
}

export interface CheckInResult {
  /** `true` when the QR had been scanned before: the numbers are the same ones. */
  readonly alreadyAssigned: boolean;
  readonly assignedAt: string;
  readonly registration: {
    readonly id: string;
    readonly fullName: string;
    readonly documentType: DocumentType;
    readonly documentNumber: string;
    readonly companionsCount: number;
    readonly status: RegistrationStatus;
  };
  readonly event: { readonly id: string; readonly slug: string; readonly name: string };
  readonly sede: { readonly id: string; readonly name: string; readonly city: string | null };
  readonly turns: readonly Turn[];
}

@Injectable({ providedIn: 'root' })
export class CheckInApi {
  readonly #api = inject(ApiClient);

  /** Numbers are always issued by the server: never compute a turn on the client. */
  scan(code: string): Observable<CheckInResult> {
    return this.#api.post<CheckInResult>('check-in/scan', { code });
  }
}
