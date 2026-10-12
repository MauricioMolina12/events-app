import { OverlayModule } from '@angular/cdk/overlay';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@core/api';
import type { Event } from '@core/domain';
import { MESSAGES } from '../../../../core/i18n/messages';
import { EventsApi } from '../../events/events.api';
import {
  RegistrationDeskApi,
  type DeskMetrics,
  type DeskRow,
  type DeskSummary,
} from '../registration-desk.api';
import { RegistrationDeskPage } from './registration-desk-page';

/**
 * The desk only presents what the server computed: the KPIs are the summary numbers as-is,
 * a titular with a turn reads as "Ingresó", and the background refresh only re-reads the
 * table when the summary actually moved.
 */

function event(id: string, status: Event['status'], name = id): Event {
  return {
    id,
    slug: id,
    name,
    description: null,
    timezone: 'America/Bogota',
    startsAt: null,
    endsAt: null,
    registrationOpensAt: null,
    registrationClosesAt: null,
    capacity: 0,
    status,
    createdBy: null,
    client: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const METRICS: DeskMetrics = {
  titulares: 120,
  companions: 80,
  people: 200,
  checkedIn: 45,
  pending: 75,
  attendanceRate: 0.375,
  turnsIssued: 90,
  lastCheckInAt: '2026-11-25T11:05:00.000Z',
};

function summary(totals: Partial<DeskMetrics> = {}): DeskSummary {
  return {
    event: { id: 'evt-live', slug: 'madrugon-2026', name: 'Madrugón 2026' },
    participationId: null,
    totals: { ...METRICS, ...totals },
    sedes: [
      {
        ...METRICS,
        participationId: 'part-barby',
        establishment: { id: 'est-1', name: 'Barby Toys', city: 'Bogotá' },
      },
    ],
  };
}

function row(id: string, checkedIn: boolean): DeskRow {
  return {
    id,
    fullName: checkedIn ? 'Ana Pérez' : 'Bruno Díaz',
    documentType: 'CC',
    documentNumber: '1020304050',
    companionsCount: checkedIn ? 2 : 0,
    people: checkedIn ? 3 : 1,
    registeredAt: '2026-11-20T15:00:00.000Z',
    sede: { id: 'part-barby', name: 'Barby Toys', city: 'Bogotá' },
    checkIn: {
      status: checkedIn ? 'checked_in' : 'pending',
      at: checkedIn ? '2026-11-25T11:05:00.000Z' : null,
      firstTurn: checkedIn ? 12 : null,
      lastTurn: checkedIn ? 14 : null,
      turnsCount: checkedIn ? 3 : 0,
      operator: checkedIn ? { id: 'u1', fullName: 'Operador Uno' } : null,
    },
  };
}

function page(items: DeskRow[]): Page<DeskRow> {
  return { items, meta: { total: items.length, limit: 20, offset: 0 } };
}

describe('RegistrationDeskPage', () => {
  let fixture: ComponentFixture<RegistrationDeskPage>;
  let api: {
    summary: ReturnType<typeof vi.fn>;
    registrations: ReturnType<typeof vi.fn>;
    companions: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api = {
      summary: vi.fn(() => of(summary())),
      registrations: vi.fn(() => of(page([row('a1b2c3d4-0000', true), row('e5f6a7b8-0000', false)]))),
      companions: vi.fn(() =>
        of([
          {
            id: 'comp-1',
            fullName: 'Lucía Pérez',
            documentType: 'CC' as const,
            documentNumber: '1099888777',
          },
        ]),
      ),
    };
    const events: Page<Event> = {
      items: [event('evt-old', 'closed'), event('evt-live', 'published', 'Madrugón 2026')],
      meta: { total: 2, limit: 100, offset: 0 },
    };

    await TestBed.configureTestingModule({
      imports: [RegistrationDeskPage, OverlayModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: RegistrationDeskApi, useValue: api },
        { provide: EventsApi, useValue: { list: () => of(events) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistrationDeskPage);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  it('defaults to the published event and shows the server metrics as-is', () => {
    expect(api.summary).toHaveBeenCalledWith('evt-live', undefined);
    const values = [...host().querySelectorAll('.kpi__value')].map((node) => node.textContent?.trim());
    expect(values).toEqual(['120', '200', '45', '75', '37,5%']);
    expect(text()).toContain(MESSAGES['desk.kpi.pending']);
  });

  it('marks a titular with a turn as checked in and shows the group turn range', () => {
    const rows = [...host().querySelectorAll('.desk-table tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain(MESSAGES['desk.status.checkedIn']);
    expect(rows[0]?.textContent).toContain('+ 2 acompañantes');
    expect(rows[0]?.textContent).toContain('12–14');
    expect(rows[0]?.textContent).toContain('A1B2C3D4');
    expect(rows[1]?.textContent).toContain(MESSAGES['desk.status.pending']);
    expect(rows[1]?.textContent).not.toContain(MESSAGES['desk.status.checkedIn']);
  });

  it('expands a row and shows that inscription companions', async () => {
    host().querySelector<HTMLElement>('.desk-row')!.click();
    await fixture.whenStable();

    expect(api.companions).toHaveBeenCalledWith('a1b2c3d4-0000');
    expect(text()).toContain(MESSAGES['desk.companions.title']);
    expect(text()).toContain('1 persona');
    expect(text()).toContain('Lucía Pérez');
  });

  it('does not open an empty companions panel when the inscription has none', async () => {
    const rows = host().querySelectorAll<HTMLElement>('.desk-row');
    rows[1]!.click();
    await fixture.whenStable();

    expect(api.companions).not.toHaveBeenCalled();
    expect(host().querySelector('.companions')).toBeNull();
    expect(text()).not.toContain(MESSAGES['desk.companions.empty']);
  });

  it('filters by sede and check-in status through the URL', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    host().querySelector<HTMLButtonElement>('.sede-row')!.click();
    expect(navigate).toHaveBeenLastCalledWith(['/panel/mesa'], {
      queryParams: { sede: 'part-barby', offset: null },
      queryParamsHandling: 'merge',
    });

    fixture.componentRef.setInput('sede', 'part-barby');
    fixture.componentRef.setInput('ingreso', 'pending');
    await fixture.whenStable();

    expect(api.summary).toHaveBeenLastCalledWith('evt-live', 'part-barby');
    expect(api.registrations).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventId: 'evt-live', participationId: 'part-barby', checkIn: 'pending' }),
    );
  });

  it('polls only the summary and re-reads the table when the numbers changed', async () => {
    const tableCalls = api.registrations.mock.calls.length;

    vi.advanceTimersByTime(20_000);
    await fixture.whenStable();
    expect(api.summary).toHaveBeenCalledTimes(2);
    expect(api.registrations).toHaveBeenCalledTimes(tableCalls);

    api.summary.mockReturnValue(of(summary({ checkedIn: 46, pending: 74 })));
    vi.advanceTimersByTime(20_000);
    await fixture.whenStable();
    expect(api.summary).toHaveBeenCalledTimes(3);
    // Table and history, once each.
    expect(api.registrations).toHaveBeenCalledTimes(tableCalls + 2);
    expect(host().querySelectorAll('.kpi__value')[2]?.textContent?.trim()).toBe('46');
  });
});
