import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
} from '@angular/core';

@Component({
  selector: 'app-tooltip-panel',
  template: '<span class="tooltip">{{ text }}</span>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipPanel {
  text = '';
}

/**
 * Hover/focus tooltip. Disabled when empty so collapsed-only labels can turn it off
 * without removing the directive.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class TooltipDirective implements OnDestroy {
  readonly appTooltip = input('');
  readonly appTooltipDisabled = input(false);

  readonly #overlay = inject(Overlay);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  #ref: OverlayRef | null = null;

  show(): void {
    if (this.appTooltipDisabled() || !this.appTooltip() || this.#ref) {
      return;
    }
    const overlay = this.#overlay.create({
      positionStrategy: this.#overlay
        .position()
        .flexibleConnectedTo(this.#host)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withPositions([
          { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
          {
            originX: 'center',
            originY: 'top',
            overlayX: 'center',
            overlayY: 'bottom',
            offsetY: -8,
          },
          { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 },
        ]),
      scrollStrategy: this.#overlay.scrollStrategies.close(),
      panelClass: 'app-tooltip-pane',
    });
    const portal = new ComponentPortal(TooltipPanel);
    const ref: ComponentRef<TooltipPanel> = overlay.attach(portal);
    ref.instance.text = this.appTooltip();
    this.#ref = overlay;
  }

  hide(): void {
    this.#ref?.dispose();
    this.#ref = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
