import { OverlayModule } from '@angular/cdk/overlay';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Select } from './select';

describe('Select', () => {
  let fixture: ComponentFixture<Select>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Select, OverlayModule],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(Select);
    fixture.componentRef.setInput('options', [
      { value: '', label: 'Todos' },
      { value: 'published', label: 'Publicado' },
      { value: 'draft', label: 'Borrador' },
    ]);
    fixture.componentRef.setInput('value', '');
    fixture.componentRef.setInput('placeholder', 'Estado');
    await fixture.whenStable();
  });

  it('shows the selected label on the trigger', async () => {
    expect(fixture.nativeElement.textContent).toContain('Todos');
  });

  it('opens the listbox and emits the chosen value', async () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => emitted.push(value));

    fixture.nativeElement.querySelector('button')?.click();
    await fixture.whenStable();

    const option = document.querySelector(
      '[role="option"][aria-selected="false"]',
    ) as HTMLButtonElement;
    expect(option).not.toBeNull();
    option.click();
    await fixture.whenStable();

    expect(emitted).toEqual(['published']);
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it('closes with Escape and restores focus to the trigger', async () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click();
    await fixture.whenStable();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    document
      .querySelector('[role="listbox"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
