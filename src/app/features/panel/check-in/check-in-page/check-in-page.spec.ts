import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api';
import { MESSAGES } from '../../../../core/i18n/messages';
import { CheckInApi, type CheckInResult } from '../check-in.api';
import { CheckInPage } from './check-in-page';

/**
 * The turn numbers come from the server; the page only has to show them big, in order, and
 * make a repeated scan obvious so the staff doesn't hand out a second number.
 */

function result(alreadyAssigned = false): CheckInResult {
  return {
    alreadyAssigned,
    assignedAt: '2026-11-25T15:04:00.000Z',
    registration: {
      id: '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      fullName: 'Ana Pérez',
      documentType: 'CC',
      documentNumber: '1020304000',
      companionsCount: 2,
      status: 'confirmed',
    },
    event: { id: 'evt-1', slug: 'gran-madrugon-2026', name: 'Gran Madrugón 2026' },
    sede: { id: 'part-1', name: 'Sede Norte', city: 'Bogotá' },
    turns: [
      { number: 41, position: 0, role: 'holder', fullName: 'Ana Pérez' },
      { number: 42, position: 1, role: 'companion', fullName: 'Luis Pérez' },
      { number: 43, position: 2, role: 'companion', fullName: 'Marta Gil' },
    ],
  };
}

describe('CheckInPage', () => {
  let fixture: ComponentFixture<CheckInPage>;
  let scan: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // No camera in the test runner: the page must fall back to the manual field.
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    scan = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CheckInPage],
      providers: [provideZonelessChangeDetection(), { provide: CheckInApi, useValue: { scan } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckInPage);
    await fixture.whenStable();
  });

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function submit(code: string): Promise<void> {
    const host = fixture.nativeElement as HTMLElement;
    const input = host.querySelector<HTMLInputElement>('#check-in-code');
    input!.value = code;
    input!.dispatchEvent(new Event('input'));
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('offers the manual field when there is no camera', () => {
    expect(text()).toContain(MESSAGES['checkIn.camera.unavailable']);
    expect((fixture.nativeElement as HTMLElement).querySelector('#check-in-code')).not.toBeNull();
  });

  it('shows one turn per person, titular first', async () => {
    scan.mockReturnValue(of(result()));
    await submit(' 3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d ');

    expect(scan).toHaveBeenCalledWith('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');
    const numbers = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.turn-card__number'),
    ].map((node) => node.textContent?.trim());
    expect(numbers).toEqual(['41', '42', '43']);
    expect(text()).toContain(MESSAGES['checkIn.result.assigned']);
    expect(text()).toContain('Gran Madrugón 2026');
  });

  it('flags a repeated scan instead of looking like a new turn', async () => {
    scan.mockReturnValue(of(result(true)));
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    expect(text()).toContain(MESSAGES['checkIn.result.already']);
    expect(text()).not.toContain(MESSAGES['checkIn.result.assigned']);
  });

  it('explains a cancelled registration and lets the staff scan the next one', async () => {
    scan.mockReturnValue(
      throwError(() => new ApiError({ status: 409, code: 'QR_REVOKED', message: 'x' })),
    );
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    expect(text()).toContain(MESSAGES['errors.qrRevoked']);
    const next = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.includes(MESSAGES['checkIn.next']),
    );
    next!.click();
    await fixture.whenStable();

    expect(text()).not.toContain(MESSAGES['errors.qrRevoked']);
    expect((fixture.nativeElement as HTMLElement).querySelector('.turn-card')).toBeNull();
  });
});
