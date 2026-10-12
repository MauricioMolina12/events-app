import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api';
import { MESSAGES } from '../../../../core/i18n/messages';
import { CheckInApi, type CheckInPreview, type CheckInResult } from '../check-in.api';
import { CheckInPage } from './check-in-page';

/**
 * The turn numbers come from the server. The page must ask who arrived before
 * requesting them, and a repeated scan must skip the questions.
 */

const COMPANIONS = [
  { id: 'cmp-luis', fullName: 'Luis Pérez', documentType: 'CC' as const, documentNumber: '1020' },
  { id: 'cmp-marta', fullName: 'Marta Gil', documentType: null, documentNumber: null },
];

function preview(alreadyAssigned = false): CheckInPreview {
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
    companions: alreadyAssigned
      ? COMPANIONS.slice(0, 1).map((companion) => ({ ...companion, checkedIn: true }))
      : COMPANIONS,
    turns: alreadyAssigned
      ? [
          { number: 41, position: 0, role: 'holder', fullName: 'Ana Pérez' },
          { number: 42, position: 1, role: 'companion', fullName: 'Luis Pérez' },
        ]
      : [],
  };
}

function result(releasedCompanionsCount = 0): CheckInResult {
  return {
    ...preview(),
    alreadyAssigned: false,
    releasedCompanionsCount,
    companions: releasedCompanionsCount > 0 ? COMPANIONS.slice(0, 1) : COMPANIONS,
    turns: [
      { number: 41, position: 0, role: 'holder', fullName: 'Ana Pérez' },
      { number: 42, position: 1, role: 'companion', fullName: 'Luis Pérez' },
      ...(releasedCompanionsCount > 0
        ? []
        : [{ number: 43, position: 2, role: 'companion' as const, fullName: 'Marta Gil' }]),
    ],
  };
}

describe('CheckInPage', () => {
  let fixture: ComponentFixture<CheckInPage>;
  let lookup: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    lookup = vi.fn();
    confirm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CheckInPage],
      providers: [
        provideZonelessChangeDetection(),
        { provide: CheckInApi, useValue: { lookup, confirm } },
      ],
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

  function clickNamed(label: string): HTMLButtonElement {
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (node) => node.textContent?.includes(label),
    );
    expect(button).toBeTruthy();
    button!.click();
    return button!;
  }

  it('offers the manual field when there is no camera', () => {
    expect(text()).toContain(MESSAGES['checkIn.camera.unavailable']);
    expect((fixture.nativeElement as HTMLElement).querySelector('#check-in-code')).not.toBeNull();
  });

  it('asks if the titular is present before assigning turns', async () => {
    lookup.mockReturnValue(of(preview()));
    await submit(' 3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d ');

    expect(lookup).toHaveBeenCalledWith('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');
    expect(confirm).not.toHaveBeenCalled();
    expect(text()).toContain(MESSAGES['checkIn.confirm.holderQuestion']);
    expect(text()).toContain('Ana Pérez');
    expect((fixture.nativeElement as HTMLElement).querySelector('.turn-card')).toBeNull();
  });

  it('then asks which companions arrived and assigns only those present', async () => {
    lookup.mockReturnValue(of(preview()));
    confirm.mockReturnValue(of(result(1)));
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    clickNamed(MESSAGES['checkIn.confirm.holderYes']);
    await fixture.whenStable();

    expect(text()).toContain(MESSAGES['checkIn.confirm.companionsQuestion']);
    const marta = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#check-in-companion-cmp-marta',
    );
    expect(marta?.checked).toBe(true);
    marta!.checked = false;
    marta!.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    clickNamed(MESSAGES['checkIn.confirm.submit']);
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledWith('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', {
      holderPresent: true,
      presentCompanionIds: ['cmp-luis'],
    });
    const numbers = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.turn-card__number'),
    ].map((node) => node.textContent?.trim());
    expect(numbers).toEqual(['41', '42']);
    expect(text()).toContain(MESSAGES['checkIn.result.assigned']);
  });

  it('does not assign if the titular is not at the door', async () => {
    lookup.mockReturnValue(of(preview()));
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    clickNamed(MESSAGES['checkIn.confirm.holderNo']);
    await fixture.whenStable();

    expect(confirm).not.toHaveBeenCalled();
    expect(text()).toContain(MESSAGES['checkIn.error.holderAbsent']);
    expect((fixture.nativeElement as HTMLElement).querySelector('.turn-card')).toBeNull();
  });

  it('skips the questions when the code already had turns', async () => {
    lookup.mockReturnValue(of(preview(true)));
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    expect(confirm).not.toHaveBeenCalled();
    expect(text()).toContain(MESSAGES['checkIn.result.already']);
    expect(text()).not.toContain(MESSAGES['checkIn.confirm.holderQuestion']);
    expect(text()).not.toContain(MESSAGES['checkIn.result.assigned']);
  });

  it('explains a cancelled registration and lets the staff scan the next one', async () => {
    lookup.mockReturnValue(
      throwError(() => new ApiError({ status: 409, code: 'QR_REVOKED', message: 'x' })),
    );
    await submit('3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d');

    expect(text()).toContain(MESSAGES['errors.qrRevoked']);
    clickNamed(MESSAGES['checkIn.next']);
    await fixture.whenStable();

    expect(text()).not.toContain(MESSAGES['errors.qrRevoked']);
    expect((fixture.nativeElement as HTMLElement).querySelector('.turn-card')).toBeNull();
  });
});
