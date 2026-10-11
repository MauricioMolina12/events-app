import { DestroyRef, Directive, ElementRef, effect, inject, input, untracked } from '@angular/core';

const DURATION_MS = 650;

/**
 * Writes a number into its host, easing from the previous value when it changes.
 *
 * The final text is always the formatted server value; the animation only fills the
 * frames in between, and is skipped entirely under `prefers-reduced-motion`.
 */
@Directive({ selector: '[appCountUp]' })
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly countUpFormat = input<(value: number) => string>((value) =>
    Math.round(value).toLocaleString('es-CO'),
  );

  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  #current: number | null = null;
  #frame = 0;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      const format = this.countUpFormat();
      untracked(() => this.#animate(target, format));
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.#frame));
  }

  #animate(target: number, format: (value: number) => string): void {
    const element = this.#host.nativeElement;
    const from = this.#current ?? 0;
    this.#current = target;
    cancelAnimationFrame(this.#frame);

    const reduced =
      typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof requestAnimationFrame !== 'function' || from === target) {
      element.textContent = format(target);
      return;
    }

    const start = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(progress === 1 ? target : from + (target - from) * eased);
      if (progress < 1) {
        this.#frame = requestAnimationFrame(step);
      }
    };
    element.textContent = format(from);
    this.#frame = requestAnimationFrame(step);
  }
}
