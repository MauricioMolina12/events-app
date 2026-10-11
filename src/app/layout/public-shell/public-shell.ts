import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { TranslatePipe } from '@core/i18n';
import { WorkspaceService } from '@core/workspace/workspace.service';
import { BrandMark, ThemeToggle } from '@shared/ui';

/**
 * Chrome for the public catalog: brand header, theme switch, footer.
 *
 * Deliberately minimal — the catalog is reached from a shared link on a phone, so the
 * header must not eat vertical space. Nothing here points into the operator panel: that
 * surface is internal and a public visitor must never see an entry to it.
 *
 * The receipt (`/inscripcion/:id`) is a one-screen ticket: the shell locks to the
 * viewport and drops the footer so the QR and the summary stay on screen together.
 */
@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ThemeToggle, BrandMark],
  templateUrl: './public-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicShell {
  readonly #router = inject(Router);
  protected readonly workspace = inject(WorkspaceService);
  readonly #url = toSignal(
    this.#router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.#router.url),
    ),
    { initialValue: this.#router.url },
  );

  protected readonly year = computed(() => new Date().getFullYear());
  protected readonly homeLink = '/';
  /** True on the confirmation screen: fill the viewport, no page scroll. */
  protected readonly compactChrome = computed(() =>
    /^\/inscripcion\/[^/?#]+/.test(this.#url()),
  );
}
