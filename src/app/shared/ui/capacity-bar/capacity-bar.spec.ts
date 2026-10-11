import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MESSAGES, interpolate } from '../../../core/i18n/messages';
import { CapacityBar } from './capacity-bar';

describe('CapacityBar', () => {
  let fixture: ComponentFixture<CapacityBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // The app is zoneless (no `zone.js` dependency), so the TestBed must opt in too.
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  async function render(inputs: {
    taken: number;
    capacity: number;
    waitlisted?: number;
  }): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CapacityBar);
    fixture.componentRef.setInput('taken', inputs.taken);
    fixture.componentRef.setInput('capacity', inputs.capacity);
    if (inputs.waitlisted !== undefined) {
      fixture.componentRef.setInput('waitlisted', inputs.waitlisted);
    }
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const track = (host: HTMLElement) => host.querySelector('[role="progressbar"]') as HTMLElement;

  it('exposes the accessible progressbar values', async () => {
    const host = await render({ taken: 3, capacity: 10 });

    expect(track(host).getAttribute('aria-valuenow')).toBe('3');
    expect(track(host).getAttribute('aria-valuemin')).toBe('0');
    expect(track(host).getAttribute('aria-valuemax')).toBe('10');
    expect(track(host).querySelector('div')?.style.width).toBe('30%');
  });

  it('shows the remaining slots while there is room', async () => {
    const host = await render({ taken: 3, capacity: 10 });

    expect(host.textContent).toContain(
      interpolate(MESSAGES['event.venue.remaining'], { count: 7 }),
    );
    expect(host.textContent).toContain(
      interpolate(MESSAGES['ui.capacity.takenOfTotal'], { taken: 3, total: 10 }),
    );
    expect(host.textContent).not.toContain(MESSAGES['ui.capacity.full']);
  });

  it('reports a full venue instead of a negative remainder', async () => {
    const host = await render({ taken: 12, capacity: 10 });

    expect(host.textContent).toContain(MESSAGES['ui.capacity.full']);
    // The width is clamped, so an overbooked venue never overflows the track.
    expect(track(host).querySelector('div')?.style.width).toBe('100%');
  });

  it('treats a zero capacity as empty rather than dividing by zero', async () => {
    const host = await render({ taken: 0, capacity: 0 });

    expect(track(host).querySelector('div')?.style.width).toBe('0%');
    expect(host.textContent).toContain(MESSAGES['ui.capacity.full']);
  });

  it('only mentions the waitlist when there is one', async () => {
    const withoutWaitlist = await render({ taken: 1, capacity: 10 });
    const waitlistSuffix = MESSAGES['ui.capacity.waitlisted'].replace('{count}', '').trim();
    expect(withoutWaitlist.textContent).not.toContain(waitlistSuffix);

    const withWaitlist = await render({ taken: 1, capacity: 10, waitlisted: 2 });
    expect(withWaitlist.textContent).toContain(
      interpolate(MESSAGES['ui.capacity.waitlisted'], { count: 2 }),
    );
  });

  it('switches the tone token at 80% and 100% occupancy', async () => {
    const bar = (host: HTMLElement) => track(host).querySelector('div') as HTMLElement;

    const roomy = await render({ taken: 7, capacity: 10 });
    expect(bar(roomy).classList.contains('bg-[var(--success)]')).toBe(true);

    const tight = await render({ taken: 8, capacity: 10 });
    expect(bar(tight).classList.contains('bg-[var(--warning)]')).toBe(true);

    const full = await render({ taken: 10, capacity: 10 });
    expect(bar(full).classList.contains('bg-[var(--danger)]')).toBe(true);
  });
});
