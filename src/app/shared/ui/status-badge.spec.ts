import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MESSAGES } from '../../core/i18n/messages';
import { StatusBadge, type StatusKind } from './status-badge';

describe('StatusBadge', () => {
  let fixture: ComponentFixture<StatusBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
  });

  async function render(kind: StatusKind): Promise<HTMLElement> {
    fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('kind', kind);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the chip class so the shared style applies', async () => {
    const host = await render('event.draft');

    const chip = host.querySelector('.chip') as HTMLElement;
    expect(chip).not.toBeNull();
    expect(chip.textContent?.trim()).toBe(MESSAGES['status.event.draft']);
  });

  it('uses the `--status-<suffix>` tokens instead of hardcoded colours', async () => {
    const host = await render('registration.confirmed');

    const chip = host.querySelector('.chip') as HTMLElement;
    expect(chip.style.backgroundColor).toBe('var(--status-confirmed-bg)');
    expect(chip.style.color).toBe('var(--status-confirmed-fg)');
  });

  it('labels every status with its own message', async () => {
    const cases: readonly (readonly [StatusKind, keyof typeof MESSAGES])[] = [
      ['event.archived', 'status.event.archived'],
      ['establishment.inactive', 'status.establishment.inactive'],
      ['participation.cancelled', 'status.participation.cancelled'],
      ['user.disabled', 'status.user.disabled'],
    ];

    for (const [kind, key] of cases) {
      const host = await render(kind);
      expect(host.textContent?.trim(), kind).toBe(MESSAGES[key]);
    }
  });
});
