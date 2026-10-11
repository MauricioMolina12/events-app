import { Directive, ElementRef, booleanAttribute, computed, inject, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Attribute directive rather than a component: `button[appButton]` keeps the native
 * element, so keyboard behaviour, form submission and screen-reader semantics stay
 * the browser's job instead of being re-implemented.
 *
 * ```html
 * <button type="button" appButton variant="primary" [loading]="saving()">…</button>
 * <a routerLink="/panel" appButton variant="secondary">…</a>
 * ```
 */
@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'loading() ? "true" : null',
    '[attr.disabled]': 'isNativeButton && isDisabled() ? "" : null',
    '[attr.aria-disabled]': 'isDisabled() ? "true" : null',
    '[attr.tabindex]': 'isNativeButton || !isDisabled() ? null : -1',
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly block = input(false, { transform: booleanAttribute });
  readonly icon = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });

  /** `<a>` cannot be `disabled`, so it degrades to `aria-disabled` + `tabindex="-1"`. */
  protected readonly isNativeButton =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName.toLowerCase() === 'button';

  protected readonly classes = computed(() => {
    const parts = ['btn', `btn--${this.variant()}`];
    if (this.size() !== 'md') {
      parts.push(`btn--${this.size()}`);
    }
    if (this.block()) {
      parts.push('btn--block');
    }
    if (this.icon()) {
      parts.push('btn--icon');
    }
    return parts.join(' ');
  });

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());
}
