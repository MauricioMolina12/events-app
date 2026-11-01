import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslatePipe } from '@core/i18n';
import { Icon } from '../icon/icon';

export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

const RESULT_LIMIT = 8;

let comboboxSeq = 0;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Text field that filters a long option list as the person types.
 * Only a handful of matches are painted, so a catalog of a thousand cities stays quick.
 */
@Component({
  selector: 'app-combobox',
  imports: [Icon, TranslatePipe],
  templateUrl: './combobox.html',
  styleUrl: './combobox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Combobox),
      multi: true,
    },
  ],
})
export class Combobox implements ControlValueAccessor {
  readonly options = input<readonly ComboboxOption[]>([]);
  readonly placeholder = input('');
  readonly inputId = input('');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly invalid = input(false);

  protected readonly listId = `combobox-list-${++comboboxSeq}`;
  protected readonly open = signal(false);
  protected readonly text = signal('');
  protected readonly active = signal(0);
  readonly #value = signal('');
  readonly #searching = signal(false);

  readonly #indexed = computed(() =>
    this.options().map((option) => ({
      option,
      nameKey: fold(option.label),
      fullKey: fold(option.hint ? `${option.label} ${option.hint}` : option.label),
    })),
  );

  constructor() {
    effect(() => {
      const label = this.#labelFor(this.#value());
      if (!this.#searching()) {
        this.text.set(label);
      }
    });
  }

  protected readonly results = computed(() => {
    const typed = fold(this.text().trim());
    const committed = fold(this.#labelFor(this.#value()));
    const needle = this.#searching() && typed !== committed ? typed : '';
    if (!needle) {
      return [];
    }
    const starts: ComboboxOption[] = [];
    const contains: ComboboxOption[] = [];
    const elsewhere: ComboboxOption[] = [];
    for (const entry of this.#indexed()) {
      if (entry.nameKey.startsWith(needle)) {
        starts.push(entry.option);
      } else if (entry.nameKey.includes(needle)) {
        contains.push(entry.option);
      } else if (entry.fullKey.includes(needle)) {
        elsewhere.push(entry.option);
      }
      if (starts.length >= RESULT_LIMIT) {
        break;
      }
    }
    return [...starts, ...contains, ...elsewhere].slice(0, RESULT_LIMIT);
  });

  #onChange: (value: string) => void = () => undefined;
  #onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const next = value ?? '';
    this.#value.set(next);
    if (!this.#searching()) {
      this.text.set(this.#labelFor(next));
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.#onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.#onTouched = fn;
  }

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected activeId(): string | null {
    return this.results().length > 0 ? this.optionId(this.active()) : null;
  }

  protected onFocus(event: FocusEvent): void {
    this.open.set(true);
    this.#searching.set(true);
    this.active.set(0);
    (event.target as HTMLInputElement).select();
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.text.set(value);
    this.open.set(true);
    this.#searching.set(true);
    this.active.set(0);
    if (fold(value.trim()) !== fold(this.#labelFor(this.#value()))) {
      this.#commit('');
    }
  }

  protected onBlur(): void {
    const exact = this.#indexed().find((entry) => entry.fullKey === fold(this.text().trim()));
    if (exact && this.#value() === '') {
      this.choose(exact.option);
      return;
    }
    this.open.set(false);
    this.#searching.set(false);
    this.text.set(this.#labelFor(this.#value()));
    this.#onTouched();
  }

  protected onKey(event: KeyboardEvent): void {
    const items = this.results();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.active.update((index) => (items.length === 0 ? 0 : (index + 1) % items.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.update((index) =>
        items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
      );
      return;
    }
    if (event.key === 'Enter' && this.open() && items[this.active()]) {
      event.preventDefault();
      this.choose(items[this.active()]!);
      return;
    }
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected choose(option: ComboboxOption): void {
    this.#commit(option.value);
    this.text.set(this.#labelFor(option.value));
    this.open.set(false);
    this.#searching.set(false);
    this.#onTouched();
  }

  protected clear(): void {
    this.#commit('');
    this.text.set('');
    this.open.set(true);
    this.#searching.set(true);
    this.active.set(0);
  }

  #commit(value: string): void {
    if (this.#value() === value) {
      return;
    }
    this.#value.set(value);
    this.#onChange(value);
  }

  #labelFor(value: string): string {
    const match = this.#indexed().find((entry) => entry.option.value === value);
    if (!match) {
      return '';
    }
    return match.option.hint ? `${match.option.label}, ${match.option.hint}` : match.option.label;
  }
}
