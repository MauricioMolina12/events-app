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

export interface CheckInCompanion {
  readonly id: string;
  readonly fullName: string;
  readonly documentType: DocumentType | null;
  readonly documentNumber: string | null;
  readonly checkedIn?: boolean;
}

export interface CheckInPreview {
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
  readonly companions: readonly CheckInCompanion[];
  readonly turns: readonly Turn[];
}

export interface CheckInResult extends CheckInPreview {
  readonly releasedCompanionsCount: number;
}

export interface CheckInAttendance {
  readonly holderPresent: boolean;
  readonly presentCompanionIds: readonly string[];
  readonly releaseCompanionIds?: readonly string[];
}

@Injectable({ providedIn: 'root' })
export class CheckInApi {
  readonly #api = inject(ApiClient);

  lookup(code: string): Observable<CheckInPreview> {
    return this.#api.post<CheckInPreview>('check-in/lookup', { code });
  }

  search(eventId: string, query: string): Observable<readonly CheckInPreview[]> {
    return this.#api.post<readonly CheckInPreview[]>('check-in/search', { eventId, query });
  }

  confirm(code: string, attendance: CheckInAttendance): Observable<CheckInResult> {
    return this.#api.post<CheckInResult>('check-in/scan', {
      code,
      holderPresent: attendance.holderPresent,
      presentCompanionIds: attendance.presentCompanionIds,
      releaseCompanionIds: attendance.releaseCompanionIds ?? [],
    });
  }
}
