import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  contentChild,
  inject,
  signal,
} from '@angular/core';

@Directive({
  selector: 'ng-template[appMenuContent]',
  standalone: true,
})
export class MenuContentDirective {
  readonly template = inject(TemplateRef<unknown>);
}

@Directive({
  selector: '[appMenuTrigger]',
  standalone: true,
  host: {
    '(click)': 'menu.toggle($event)',
    '[attr.aria-expanded]': 'menu.open()',
    '[attr.aria-haspopup]': '"menu"',
  },
})
export class MenuTriggerDirective {
  readonly menu = inject(Menu);
  readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
}

/**
 * Floating action menu. The trigger stays in place; the panel is portaled so it
 * is never clipped by `overflow: hidden` ancestors.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu implements OnDestroy {
  readonly open = signal(false);

  readonly overlay = inject(Overlay);
  readonly vcr = inject(ViewContainerRef);
  readonly content = contentChild(MenuContentDirective);
  readonly trigger = contentChild(MenuTriggerDirective);
  #ref: OverlayRef | null = null;

  toggle(event?: Event): void {
    event?.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    this.#open();
  }

  close(): void {
    this.#ref?.dispose();
    this.#ref = null;
    this.open.set(false);
  }

  ngOnDestroy(): void {
    this.#ref?.dispose();
    this.#ref = null;
  }

  #open(): void {
    const trigger = this.trigger()?.element.nativeElement;
    const content = this.content()?.template;
    if (!trigger || !content) {
      return;
    }
    const overlay = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(trigger)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withPositions([
          { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
          { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
        ]),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false,
    });
    overlay.attach(new TemplatePortal(content, this.vcr));
    overlay.outsidePointerEvents().subscribe(() => this.close());
    overlay.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
        trigger.focus();
      }
    });
    this.#ref = overlay;
    this.open.set(true);
    queueMicrotask(() =>
      overlay.overlayElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
    );
  }
}
