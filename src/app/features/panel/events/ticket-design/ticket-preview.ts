import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { TicketDesign } from '@core/domain';
import { I18nService } from '@core/i18n';
import { sampleTicketData } from '@features/catalog/receipt-page/ticket-sample';
import { drawTicket } from '@features/catalog/receipt-page/ticket-pdf';

/**
 * Live ticket. It paints with the same function that builds the PDF, then the browser
 * scales the bitmap. Positions on screen are the positions on the page.
 */
@Component({
  selector: 'app-ticket-preview',
  template: `
    <canvas #surface class="ticket-canvas" role="img" [attr.aria-label]="label()"></canvas>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .ticket-canvas {
      display: block;
      width: min(100%, 18rem, calc(68vh * 0.5625));
      height: auto;
      margin-inline: auto;
      border-radius: 1.15rem;
      background: var(--surface-2);
      box-shadow: var(--shadow-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketPreview {
  readonly design = input.required<TicketDesign>();
  readonly eventName = input('');
  readonly label = input('');

  readonly #i18n = inject(I18nService);
  readonly #browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly surface = viewChild<ElementRef<HTMLCanvasElement>>('surface');

  constructor() {
    effect(() => {
      const design = this.design();
      const eventName = this.eventName();
      this.#i18n.locale();
      const canvas = this.surface()?.nativeElement;
      if (!this.#browser || !canvas) {
        return;
      }
      drawTicket(
        canvas,
        sampleTicketData((key, params) => this.#i18n.t(key, params), design, eventName),
      );
    });
  }
}
