import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { SessionStore } from './session-store';
import type { UserRole } from './models';

/**
 * `*appHasRole="'admin'"` / `*appHasRole="['admin', 'operator']"`.
 *
 * Hides UI only. It never replaces a protected API call — the backend rejects
 * unauthorized requests regardless of what the client renders.
 */
@Directive({ selector: '[appHasRole]' })
export class HasRoleDirective {
  readonly appHasRole = input.required<UserRole | readonly UserRole[]>();

  readonly #template = inject<TemplateRef<unknown>>(TemplateRef);
  readonly #viewContainer = inject(ViewContainerRef);
  readonly #store = inject(SessionStore);
  #visible = false;

  constructor() {
    effect(() => {
      const required = this.appHasRole();
      const roles: readonly UserRole[] = Array.isArray(required)
        ? required
        : [required as UserRole];
      const allowed = this.#store.hasRole(...roles);
      this.#toggle(allowed);
    });
  }

  #toggle(visible: boolean): void {
    if (visible === this.#visible) {
      return;
    }
    this.#visible = visible;
    if (visible) {
      this.#viewContainer.createEmbeddedView(this.#template);
    } else {
      this.#viewContainer.clear();
    }
  }
}
