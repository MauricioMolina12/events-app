import { Component, provideZonelessChangeDetection } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Page } from '@core/api';
import type { PublicEvent, PublicParticipation } from '@core/domain';
import { MESSAGES } from '../../../core/i18n/messages';
import { CatalogApi } from '../catalog.api';
import { RegistrationEntryPage } from './registration-entry-page';

/**
 * `/inscripcion` exists to answer one question: where does this link sign me up?
 *
 * These specs pin the three answers it may give — hand over, ask, or explain why not — plus
 * the two ways the answer can fail: a slug nobody publishes and an API that does not answer.
 */

/** Stands in for the real route table; the gate only needs somewhere valid to live. */
@Component({ selector: 'app-test-blank', template: '' })
class Blank {}

interface ApiStub {
  listEvents: ReturnType<typeof vi.fn>;
  getEvent: ReturnType<typeof vi.fn>;
}

function pageOf(items: readonly PublicEvent[]): Page<PublicEvent> {
  return { items, meta: { total: items.length, limit: 50, offset: 0 } };
}

function sede(init: {
  id: string;
  name: string;
  titulares?: number;
  open?: boolean;
}): PublicParticipation {
  return {
    id: init.id,
    establishment: { id: `${init.id}-sede`, name: init.name, city: 'Bogotá' },
    availableTitulares: init.titulares ?? 5,
    availableCompanions: 0,
    registrationOpensAt: null,
    registrationClosesAt: null,
    registrationOpen: init.open ?? true,
  };
}

function evento(init: {
  slug: string;
  name: string;
  sedes: readonly PublicParticipation[];
}): PublicEvent {
  return {
    id: `${init.slug}-1`,
    slug: init.slug,
    name: init.name,
    description: null,
    timezone: 'America/Bogota',
    startsAt: '2026-04-25T15:00:00.000Z',
    endsAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    participations: init.sedes,
  };
}

describe('RegistrationEntryPage', () => {
  let fixture: ComponentFixture<RegistrationEntryPage>;
  let api: ApiStub;

  beforeEach(async () => {
    api = { listEvents: vi.fn(), getEvent: vi.fn() };
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: Blank }]),
        { provide: CatalogApi, useValue: api },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Installed **before** the component exists: the hand-over fires on first paint. */
  function spyNavigate() {
    return vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  async function render(inputs: { evento?: string; sede?: string } = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(RegistrationEntryPage);
    if (inputs.evento !== undefined) {
      fixture.componentRef.setInput('evento', inputs.evento);
    }
    if (inputs.sede !== undefined) {
      fixture.componentRef.setInput('sede', inputs.sede);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  /** The canonical address of the form, which is what a picker link has to point at. */
  function linkTo(host: HTMLElement, sedeId: string): HTMLAnchorElement | null {
    return host.querySelector<HTMLAnchorElement>(`a[data-sede="${sedeId}"]`);
  }

  it('hands over to the canonical form when only one sede can enrol', async () => {
    api.listEvents.mockReturnValue(
      of(
        pageOf([
          evento({
            slug: 'taller',
            name: 'Taller',
            sedes: [sede({ id: 's1', name: 'Sede Norte' })],
          }),
        ]),
      ),
    );
    const navigate = spyNavigate();

    const host = await render();

    expect(navigate).toHaveBeenCalledWith(['/eventos', 'taller', 'inscripcion'], {
      state: { sede: 's1' },
      replaceUrl: true,
    });
    expect(host.textContent).toContain(MESSAGES['register.entry.redirecting']);
    expect(linkTo(host, 's1')).toBeNull();
  });

  it('shows the picker when the catalogue asked to choose, even with one open sede', async () => {
    api.listEvents.mockReturnValue(
      of(
        pageOf([
          evento({
            slug: 'taller',
            name: 'Taller',
            sedes: [sede({ id: 's1', name: 'Sede Norte' })],
          }),
        ]),
      ),
    );
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({ choose: true });
    const navigate = spyNavigate();

    const host = await render();

    expect(navigate).not.toHaveBeenCalled();
    expect(linkTo(host, 's1')).not.toBeNull();
  });

  it('asks instead of guessing when several sedes can enrol', async () => {
    api.listEvents.mockReturnValue(
      of(
        pageOf([
          evento({
            slug: 'taller',
            name: 'Taller de arte',
            sedes: [sede({ id: 's1', name: 'Sede Norte' }), sede({ id: 's2', name: 'Sede Sur' })],
          }),
        ]),
      ),
    );
    const navigate = spyNavigate();

    const host = await render();

    expect(navigate).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Sede Norte');
    expect(host.textContent).toContain('Sede Sur');
    expect(linkTo(host, 's1')?.getAttribute('href')).toBe('/eventos/taller/inscripcion');
    expect(linkTo(host, 's2')).not.toBeNull();
  });

  it('honours the sede a shared link named', async () => {
    api.getEvent.mockReturnValue(
      of(
        evento({
          slug: 'taller',
          name: 'Taller de arte',
          sedes: [sede({ id: 's1', name: 'Sede Norte' }), sede({ id: 's2', name: 'Sede Sur' })],
        }),
      ),
    );
    const navigate = spyNavigate();

    await render({ evento: 'taller', sede: 's2' });

    expect(api.getEvent).toHaveBeenCalledWith('taller');
    expect(api.listEvents).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/eventos', 'taller', 'inscripcion'], {
      state: { sede: 's2' },
      replaceUrl: true,
    });
  });

  it('explains a closed sede instead of bouncing the reader', async () => {
    api.getEvent.mockReturnValue(
      of(
        evento({
          slug: 'taller',
          name: 'Taller de arte',
          sedes: [sede({ id: 's1', name: 'Sede Norte', open: false })],
        }),
      ),
    );
    const navigate = spyNavigate();

    const host = await render({ evento: 'taller' });

    expect(navigate).not.toHaveBeenCalled();
    expect(host.textContent).toContain(MESSAGES['register.entry.none']);
    expect(host.textContent).toContain(MESSAGES['event.venue.closedParticipation']);
    expect(linkTo(host, 's1')).toBeNull();
  });

  it('names an exhausted sede as full rather than closed', async () => {
    api.getEvent.mockReturnValue(
      of(
        evento({
          slug: 'taller',
          name: 'Taller de arte',
          sedes: [sede({ id: 's1', name: 'Sede Norte', titulares: 0 })],
        }),
      ),
    );

    const host = await render({ evento: 'taller' });

    expect(host.textContent).toContain(MESSAGES['ui.capacity.full']);
    expect(linkTo(host, 's1')).toBeNull();
  });

  it('turns a slug nobody publishes into a not-found screen', async () => {
    api.getEvent.mockReturnValue(
      throwError(() => new ApiError({ status: 404, code: 'EVENT_NOT_FOUND', message: 'Nope' })),
    );

    const host = await render({ evento: 'evento-viejo' });

    expect(host.textContent).toContain(MESSAGES['app.notFound.title']);
    expect(host.textContent).toContain(MESSAGES['register.entry.browse']);
  });

  it('offers a retry when the catalogue cannot be reached', async () => {
    api.listEvents
      .mockReturnValueOnce(
        throwError(
          () =>
            new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Sin red', offline: true }),
        ),
      )
      .mockReturnValue(
        of(
          pageOf([
            evento({ slug: 'taller', name: 'Taller', sedes: [sede({ id: 's1', name: 'Norte' })] }),
          ]),
        ),
      );
    const navigate = spyNavigate();

    const host = await render();
    expect(host.textContent).toContain(MESSAGES['app.error.title']);
    expect(host.textContent).toContain(MESSAGES['ui.retryOffline']);

    host.querySelector('button')?.click();
    await fixture.whenStable();

    expect(api.listEvents).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith(['/eventos', 'taller', 'inscripcion'], {
      state: { sede: 's1' },
      replaceUrl: true,
    });
  });

  it('says so when the catalogue has no events at all', async () => {
    api.listEvents.mockReturnValue(of(pageOf([])));

    const host = await render();

    expect(host.textContent).toContain(MESSAGES['catalog.empty.title']);
  });
});
