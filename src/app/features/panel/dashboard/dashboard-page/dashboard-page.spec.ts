import { OverlayModule } from '@angular/cdk/overlay';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionStore } from '@core/auth';
import { MESSAGES } from '../../../../core/i18n/messages';
import {
  RegistrationDeskApi,
  type DeskMetrics,
  type DeskSummary,
} from '../../registration-desk/registration-desk.api';
import {
  DashboardApi,
  type ActivityItem,
  type DashboardOverview,
  type OverviewEvent,
  type RegistrationTimeline,
} from '../dashboard.api';
import { DashboardPage, buildAttention } from './dashboard-page';

/**
 * The dashboard only presents what the API computed: the cards are the summary numbers
 * as-is, filters reach every request, and the background refresh re-reads the rest only
 * when the summary moved.
 */

const METRICS: DeskMetrics = {
  titulares: 120,
  companions: 80,
  people: 200,
  checkedIn: 0,
  pending: 120,
  attendanceRate: 0,
  turnsIssued: 0,
  lastCheckInAt: null,
};

function overviewEvent(id: string, overrides: Partial<OverviewEvent> = {}): OverviewEvent {
  return {
    id,
    slug: id,
    name: id,
    status: 'published',
    phase: 'registration_open',
    timezone: 'America/Bogota',
    startsAt: '2026-11-28T10:00:00.000Z',
    endsAt: '2026-11-28T18:00:00.000Z',
    registrationOpensAt: null,
    registrationClosesAt: null,
    sedes: [
      { participationId: 'part-barby', name: 'Barby Toys' },
      { participationId: 'part-cupidos', name: 'Cupidos' },
    ],
    titulares: 120,
    people: 200,
    checkedIn: 0,
    attendanceRate: 0,
    capacity: 300,
    companions: 80,
    available: 100,
    occupancy: 66.7,
    occupancyLevel: 'normal',
    client: null,
    ...overrides,
  };
}

function overview(items: OverviewEvent[]): DashboardOverview {
  return {
    generatedAt: '2026-10-10T12:00:00.000Z',
    events: {
      total: items.length,
      active: 1,
      byStatus: { draft: 0, published: items.length, closed: 0, archived: 0 },
    },
    items,
    clients: null,
  };
}

function summary(totals: Partial<DeskMetrics> = {}): DeskSummary {
  const merged = { ...METRICS, ...totals };
  return {
    event: { id: 'madrugon', slug: 'madrugon', name: 'Madrugón 2026' },
    participationId: null,
    totals: merged,
    sedes: [
      {
        ...METRICS,
        titulares: 70,
        people: 120,
        pending: 70,
        participationId: 'part-barby',
        establishment: { id: 'e1', name: 'Barby Toys', city: null },
      },
      {
        ...METRICS,
        titulares: 50,
        people: 80,
        pending: 50,
        participationId: 'part-cupidos',
        establishment: { id: 'e2', name: 'Cupidos', city: null },
      },
    ],
  };
}

const TIMELINE: RegistrationTimeline = {
  timezone: 'America/Bogota',
  granularity: 'day',
  total: 120,
  last24h: 14,
  buckets: [
    { date: '2026-10-08', hour: null, titulares: 60, people: 100, cumulative: 60 },
    { date: '2026-10-09', hour: null, titulares: 46, people: 80, cumulative: 106 },
    { date: '2026-10-10', hour: null, titulares: 14, people: 20, cumulative: 120 },
  ],
};

const ACTIVITY: readonly ActivityItem[] = [
  {
    type: 'registration',
    at: '2026-10-10T16:00:00.000Z',
    registration: { id: 'a1b2c3d4-0000', fullName: 'Ana Pérez', people: 3, sede: 'Barby Toys' },
  },
];

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let dashboard: {
    overview: ReturnType<typeof vi.fn>;
    timeline: ReturnType<typeof vi.fn>;
    activity: ReturnType<typeof vi.fn>;
  };
  let desk: { summary: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    dashboard = {
      overview: vi.fn(() =>
        of(
          overview([
            overviewEvent('madrugon', {
              name: 'Madrugón 2026',
              client: { id: 'c-barby', slug: 'barby', displayName: 'Barby' },
            }),
            overviewEvent('pasado', {
              phase: 'finished',
              client: { id: 'c-otro', slug: 'otro', displayName: 'Otro cliente' },
            }),
          ]),
        ),
      ),
      timeline: vi.fn(() => of(TIMELINE)),
      activity: vi.fn(() => of(ACTIVITY)),
    };
    desk = { summary: vi.fn(() => of(summary())) };

    await TestBed.configureTestingModule({
      imports: [DashboardPage, OverlayModule],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DashboardApi, useValue: dashboard },
        { provide: RegistrationDeskApi, useValue: desk },
        { provide: SessionStore, useValue: { isAdmin: signal(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const kpi = (id: string): string =>
    host().querySelector(`[data-kpi="${id}"] .kpi__value`)?.textContent?.trim() ?? '';

  it('shows the server metrics as-is and keeps titulares apart from people', async () => {
    fixture.componentRef.setInput('evento', 'madrugon');
    await fixture.whenStable();
    expect(desk.summary).toHaveBeenCalledWith('madrugon', undefined);
    expect(kpi('events')).toBe('2');
    expect(kpi('titulares')).toBe('120');
    expect(kpi('people')).toBe('200');
    expect(kpi('checkedIn')).toBe('0');
    expect(kpi('pending')).toBe('120');
    expect(kpi('attendance')).toBe('0%');
    expect(host().querySelector('[data-kpi="titulares"]')?.textContent).toContain('+14 en 24 h');
  });

  it('leads with registration numbers before scanning and with entries once it starts', async () => {
    fixture.componentRef.setInput('evento', 'madrugon');
    await fixture.whenStable();
    const order = (): (string | null)[] =>
      [...host().querySelectorAll('.kpi')].map((node) => node.getAttribute('data-kpi'));
    expect(order().slice(0, 3)).toEqual(['titulares', 'people', 'attendance']);

    desk.summary.mockReturnValue(
      of(summary({ checkedIn: 45, pending: 75, attendanceRate: 0.375 })),
    );
    vi.advanceTimersByTime(20_000);
    await fixture.whenStable();

    expect(order().slice(0, 3)).toEqual(['checkedIn', 'pending', 'attendance']);
    expect(kpi('attendance')).toBe('37,5%');
  });

  it('shows an informative state instead of 0% when there are no titulares', async () => {
    desk.summary.mockReturnValue(
      of(summary({ titulares: 0, companions: 0, people: 0, pending: 0 })),
    );
    dashboard.timeline.mockReturnValue(of({ ...TIMELINE, total: 0, last24h: 0, buckets: [] }));
    fixture.componentRef.setInput('evento', 'pasado');
    await fixture.whenStable();

    expect(kpi('attendance')).toBe('—');
    expect(host().textContent).toContain(MESSAGES['dash.checkIn.empty']);
    expect(host().textContent).toContain(MESSAGES['dash.timeline.empty']);
    expect(host().querySelector('app-check-in-donut')).toBeNull();
  });

  it('sends the selected sede to every request and ignores sedes from other events', async () => {
    fixture.componentRef.setInput('evento', 'madrugon');
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const buttons = [...host().querySelectorAll<HTMLButtonElement>('.context .segmented__item')];
    buttons.find((button) => button.textContent?.includes('Cupidos'))!.click();
    expect(navigate).toHaveBeenLastCalledWith(['/panel'], {
      queryParams: { sede: 'part-cupidos' },
      queryParamsHandling: 'merge',
    });

    fixture.componentRef.setInput('sede', 'part-cupidos');
    await fixture.whenStable();
    const scope = { eventId: 'madrugon', participationId: 'part-cupidos' };
    expect(desk.summary).toHaveBeenLastCalledWith('madrugon', 'part-cupidos');
    expect(dashboard.timeline).toHaveBeenLastCalledWith(scope);
    expect(dashboard.activity).toHaveBeenLastCalledWith(scope, 8);

    fixture.componentRef.setInput('sede', 'part-de-otro-evento');
    await fixture.whenStable();
    expect(desk.summary).toHaveBeenLastCalledWith('madrugon', undefined);
  });

  it('polls only the summary and re-reads the rest when the numbers changed', async () => {
    fixture.componentRef.setInput('evento', 'madrugon');
    await fixture.whenStable();
    const calls = (): number[] => [
      dashboard.overview.mock.calls.length,
      dashboard.timeline.mock.calls.length,
      dashboard.activity.mock.calls.length,
    ];
    const before = calls();

    vi.advanceTimersByTime(20_000);
    await fixture.whenStable();
    expect(desk.summary).toHaveBeenCalledTimes(2);
    expect(calls()).toEqual(before);

    desk.summary.mockReturnValue(
      of(summary({ checkedIn: 1, pending: 119, attendanceRate: 0.0083 })),
    );
    vi.advanceTimersByTime(20_000);
    await fixture.whenStable();
    expect(calls()).toEqual(before.map((value) => value + 1));
  });

  it('links the quick actions to real routes, with the desk carrying the selected event', async () => {
    fixture.componentRef.setInput('evento', 'madrugon');
    await fixture.whenStable();
    const hrefs = [...host().querySelectorAll<HTMLAnchorElement>('.quick a')].map((link) =>
      link.getAttribute('href'),
    );
    expect(hrefs).toEqual([
      '/panel/mesa?evento=madrugon',
      '/panel/ingreso',
      '/panel/mesa?evento=madrugon&orden=registeredAt&dir=desc',
      '/panel/eventos',
      '/panel/sedes',
    ]);
  });

  it('opens across every client instead of the first event', () => {
    expect(desk.summary).not.toHaveBeenCalled();
    expect(host().textContent).toContain(MESSAGES['dash.aforo.allClients']);
    expect(host().textContent).toContain(MESSAGES['dash.context.allEvents']);
    expect(host().textContent).toContain('Madrugón 2026');
    expect(host().textContent).toContain('pasado');
  });

  it('shows only the events of the client named in the query', async () => {
    fixture.componentRef.setInput('cliente', 'barby');
    await fixture.whenStable();
    expect(desk.summary).not.toHaveBeenCalled();
    expect(host().textContent).toContain('Madrugón 2026');
    expect(host().textContent).toContain('Barby');
    expect(host().textContent).not.toContain('pasado');
  });

  it('never presents a finished event as active', async () => {
    fixture.componentRef.setInput('evento', 'pasado');
    await fixture.whenStable();
    const phase = host().querySelector('.context .phase');
    expect(phase?.textContent).toContain(MESSAGES['dash.phase.finished']);
    expect(phase?.classList.contains('is-live')).toBe(false);
    expect(host().querySelector('.attention')?.textContent).toContain('finalizó');
  });
});

describe('buildAttention', () => {
  const context = {
    isAdmin: false,
    date: (iso: string) => iso.slice(0, 10),
    t: (key: string) => key,
  } as never;

  it('flags a sede without registrations and pending entries per sede during the event', () => {
    const data = summary();
    const sedes = [{ ...data.sedes[0]!, titulares: 0, pending: 0 }, data.sedes[1]!];
    const items = buildAttention(
      overviewEvent('madrugon', { phase: 'in_progress' }),
      { ...data, sedes },
      context,
    );
    expect(items.map((item) => item.message)).toEqual([
      'dash.attention.sedeEmpty',
      'dash.attention.sedePending',
    ]);
    expect(items[1]?.link).toMatchObject({
      route: '/panel/mesa',
      query: { evento: 'madrugon', sede: 'part-cupidos', ingreso: 'pending' },
    });
  });

  it('says nothing when there is nothing to act on', () => {
    expect(buildAttention(overviewEvent('madrugon'), summary(), context)).toEqual([]);
  });
});
