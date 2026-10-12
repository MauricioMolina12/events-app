import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiClient } from '@core/api';
import type { CreateRegistrationRequest, RegistrationDetail } from '@core/domain';

@Injectable({ providedIn: 'root' })
export class RegistrationsApi {
  readonly #api = inject(ApiClient);

  create(request: CreateRegistrationRequest): Observable<RegistrationDetail> {
    return this.#api.post<RegistrationDetail>('registrations', request);
  }
}
