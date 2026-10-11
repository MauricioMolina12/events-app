import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@core/i18n';
import { Icon } from '../icon/icon';

export interface SelectChoice {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

let selectSeq = 0;

/**
 * Accessible listbox select. Used in the panel for filters and short option lists.
 * Native `<select>` stays on the public catalog (document type, mobile-first).
 */
@Component({
  selector: 'app-select',
  imports: [Icon, TranslatePipe],
  templateUrl: './select.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Select),
      multi: true,
    },
  ],
})
export class Select implements ControlValueAccessor, OnDestroy {
  readonly options = input<readonly SelectChoice[]>([]);
  readonly value = input<string | undefined>(undefined);
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly searchable = input<boolean | undefined>(undefined);
  readonly appearance = input<'field' | 'title'>('field');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly valueChange = output<string>();

  protected readonly panelId = `app-select-${++selectSeq}`;
  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);
  protected readonly current = signal('');
  protected readonly cvaDisabled = signal(false);

  protected readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected readonly panelTpl = viewChild.required<TemplateRef<unknown>>('panel');
  protected readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly #overlay = inject(Overlay);
  readonly #vcr = inject(ViewContainerRef);
  #ref: OverlayRef | null = null;
  #onChange: (value: string) => void = () => undefined;
  #onTouched: () => void = () => undefined;

  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  protected readonly selected = computed(() => {
    const value = this.value() !== undefined ? this.value()! : this.current();
    return this.options().find((option) => option.value === value) ?? null;
  });
  protected readonly showSearch = computed(
    () => this.searchable() === true || (this.searchable() !== false && this.options().length >= 8),
  );
  protected readonly filtered = computed(() => {
    const needle = this.query().trim().toLowerCase();
    if (!needle) {
      return this.options();
    }
    return this.options().filter((option) => option.label.toLowerCase().includes(needle));
  });

  writeValue(value: string | null): void {
    this.current.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.#onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  ngOnDestroy(): void {
    this.#ref?.dispose();
    this.#ref = null;
  }

  protected toggle(): void {
    if (this.isDisabled()) {
      return;
    }
    if (this.open()) {
      this.close();
      return;
    }
    this.#openPanel();
  }

  protected close(): void {
    this.#ref?.dispose();
    this.#ref = null;
    this.open.set(false);
    this.query.set('');
    this.trigger().nativeElement.focus();
  }

  protected choose(option: SelectChoice): void {
    if (option.disabled) {
      return;
    }
    this.current.set(option.value);
    this.#onChange(option.value);
    this.valueChange.emit(option.value);
    this.close();
  }

  protected onTriggerKey(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      if (!this.open()) {
        this.#openPanel();
      }
    }
  }

  protected onPanelKey(event: KeyboardEvent): void {
    const items = this.filtered();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.set(Math.min(items.length - 1, this.activeIndex() + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, this.activeIndex() - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.activeIndex.set(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.activeIndex.set(Math.max(0, items.length - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = items[this.activeIndex()];
      if (option) {
        this.choose(option);
      }
    }
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  #openPanel(): void {
    const origin = this.trigger().nativeElement;
    const selected = this.selected()?.value ?? this.value() ?? this.current();
    const index = this.options().findIndex((option) => option.value === selected);
    this.activeIndex.set(index >= 0 ? index : 0);
    this.open.set(true);

    const overlay = this.#overlay.create({
      positionStrategy: this.#overlay
        .position()
        .flexibleConnectedTo(origin)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
        ]),
      scrollStrategy: this.#overlay.scrollStrategies.reposition(),
      width: Math.max(origin.offsetWidth, 12 * 16),
      hasBackdrop: false,
    });
    overlay.attach(new TemplatePortal(this.panelTpl(), this.#vcr));
    overlay.outsidePointerEvents().subscribe(() => this.close());
    overlay.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    this.#ref = overlay;
    queueMicrotask(() => {
      const search = this.searchInput()?.nativeElement;
      (search ?? overlay.overlayElement.querySelector<HTMLElement>('[role="option"]'))?.focus();
    });
    this.#onTouched();
  }
}
