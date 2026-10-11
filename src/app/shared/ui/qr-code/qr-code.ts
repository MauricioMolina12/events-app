import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { encode } from 'uqr';

interface QrCell {
  readonly x: number;
  readonly y: number;
}

/**
 * Renders a scannable QR as inline SVG.
 *
 * The matrix comes from `uqr` (byte mode, ECC M). Only the pass token or the folio
 * is encoded — no name, no document — so a screenshot of the comprobante does not
 * leak extra personal data beyond what the folio already identifies.
 */
@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrCode {
  readonly value = input.required<string>();
  readonly label = input('');

  protected readonly encoded = computed(() => {
    const value = this.value();
    return value ? encode(value, { ecc: 'M', border: 1 }) : null;
  });

  protected readonly modules = computed<readonly QrCell[]>(() => {
    const encoded = this.encoded();
    if (!encoded) {
      return [];
    }

    const cells: QrCell[] = [];
    const { data, size } = encoded;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (data[y]?.[x]) {
          cells.push({ x, y });
        }
      }
    }

    return cells;
  });

  protected readonly viewBox = computed(() => {
    const size = this.encoded()?.size ?? 1;
    return `0 0 ${size} ${size}`;
  });
}
