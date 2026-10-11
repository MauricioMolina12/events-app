import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api';
import type { PublicEvent, PublicHolderRegistration } from '@core/domain';
import { MESSAGES } from '../../../core/i18n/messages';
import { CatalogApi } from '../catalog.api';
import { AddCompanionsPage } from './add-companions-page';

/**
 * "Agregar acompañante" must never offer more rows than the titular has left: two per titular,
 * counting the ones already in the alta, and never more than the sede can still seat.
 */

@Component({ selector: 'app-test-blank', template: '' })
class Blank {}

const EVENT: PublicEvent = {
  id: 'evt-1',
  slug: 'gran-madrugon-2026',
  name: 'Gran Madrugón 2026',
  description: null,
  timezone: 'America/Bogota',
  startsAt: '2026-11-25T15:00:00.000Z',
  endsAt: null,
  registrationOpensAt: null,
  registrationClosesAt: null,
  participations: [
    {
      id: 'part-1',
      establishment: { id: 'est-1', name: 'Sede Norte', city: 'Bogotá' },
      availableTitulares: 0,
      availableCompanions: 10,
      registrationOpensAt: null,
      registrationClosesAt: null,
      registrationOpen: true,
    },
  ],
};

function holder(companionsCount: number): PublicHolderRegistration {
  return {
    id: 'reg-1',
    participationId: 'part-1',
    documentType: 'CC',
    documentNumber: '1020304000',
    fullName: 'Ana Pérez',
    companionsCount,
    status: 'confirmed',
    registeredAt: '2026-10-01T15:00:00.000Z',
    maxCompanions: 2,
  };
}

describe('AddCompanionsPage', () => {
  let fixture: ComponentFixture<AddCompanionsPage>;
  let api: Record<
    'getEvent' | 'listEvents' | 'lookupHolderRegistration' | 'addCompanions',
    ReturnType<typeof vi.fn>
  >;

  beforeEach(async () => {
    api = {
      getEvent: vi.fn().mockReturnValue(of(EVENT)),
      listEvents: vi.fn(),
      lookupHolderRegistration: vi.fn(),
      addCompanions: vi.fn(),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: Blank }]),
        { provide: CatalogApi, useValue: api },
      ],
    }).compileComponents();
  });

  async function findHolder(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(AddCompanionsPage);
    fixture.componentRef.setInput('slug', EVENT.slug);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    const type = (selector: string, value: string): void => {
      const input = host.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    type('#addDocumentNumber', '1020304000');
    type('#addEmail', 'ana@example.com');
    host.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    return host;
  }

  it('looks the titular up in the event of the path', async () => {
    api.lookupHolderRegistration.mockReturnValue(of(holder(0)));
    await findHolder();

    expect(api.lookupHolderRegistration).toHaveBeenCalledWith({
      event: EVENT.slug,
      documentType: 'CC',
      documentNumber: '1020304000',
      email: 'ana@example.com',
    });
  });

  it('offers only the one row left when the titular already has a companion', async () => {
    api.lookupHolderRegistration.mockReturnValue(of(holder(1)));
    const host = await findHolder();

    expect(host.querySelectorAll('[id^="addComp"][id$="Name"]')).toHaveLength(1);
    const add = [...host.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes(MESSAGES['register.companions.add']),
    );
    expect(add?.disabled).toBe(true);
  });

  it('blocks the form once the titular has two companions', async () => {
    api.lookupHolderRegistration.mockReturnValue(of(holder(2)));
    const host = await findHolder();

    expect(host.textContent).toContain(MESSAGES['companions.limit.title']);
    expect(host.querySelector('[id^="addComp"]')).toBeNull();
  });

  it('says plainly when no alta matches the data', async () => {
    api.lookupHolderRegistration.mockReturnValue(
      throwError(
        () =>
          new ApiError({ status: 404, code: 'REGISTRATION_NOT_FOUND', message: 'No encontrada' }),
      ),
    );
    const host = await findHolder();

    expect(host.textContent).toContain(MESSAGES['companions.lookup.notFound']);
  });
});
