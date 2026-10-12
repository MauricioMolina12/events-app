import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

/**
 * Logotipo del espacio, o las iniciales cuando no hay imagen o esta no carga.
 */
@Component({
  selector: 'app-brand-mark',
  templateUrl: './brand-mark.html',
  styleUrl: './brand-mark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMark {
  readonly src = input<string | null>(null);
  /** Same mark for dark backgrounds. Falls back to `src` when omitted. */
  readonly darkSrc = input<string | null>(null);
  readonly initials = input('E');
  readonly wide = input(false);

  protected readonly broken = signal(false);

  constructor() {
    effect(() => {
      this.src();
      this.broken.set(false);
    });
  }

  protected onError(): void {
    this.broken.set(true);
  }
}
