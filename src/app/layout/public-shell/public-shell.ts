import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';
import { ClientsApi } from '@core/clients/clients.api';
import { I18nService, TranslatePipe } from '@core/i18n';
import { brandInitials } from '@core/workspace/brand-color';
import { BrandMark, ThemeToggle } from '@shared/ui';

/**
 * Chrome for the public catalog: brand header, theme switch, footer.
 *
 * Deliberately minimal — the catalog is reached from a shared link on a phone, so the
 * header must not eat vertical space. Nothing here points into the operator panel: that
 * surface is internal and a public visitor must never see an entry to it.
 *
 * The receipt (`/inscripcion/:id`) drops the footer so the ticket stays the focus.
 * The header keeps the same size as the rest of the public catalog.
 */
@Component({
  selector: 'app-public-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, ThemeToggle, BrandMark],
  templateUrl: './public-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicShell {
  readonly #router = inject(Router);
  readonly #clients = inject(ClientsApi);
  readonly #i18n = inject(I18nService);
  readonly #url = toSignal(
    this.#router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.#router.url),
    ),
    { initialValue: this.#router.url },
  );

  /** Only `/clientes/:slug/...` belongs to one client. `/eventos` is the directory. */
  protected readonly clientSlug = computed(() => {
    const path = this.#url().split(/[?#]/, 1)[0] ?? '';
    const match = /^\/clientes\/([^/]+)/.exec(path);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  });

  readonly #clientName = toSignal(
    toObservable(this.clientSlug).pipe(
      switchMap((slug) =>
        slug
          ? this.#clients.listPublic().pipe(
              map(
                (clients) => clients.find((client) => client.slug === slug)?.displayName ?? '',
              ),
              catchError(() => of('')),
            )
          : of(''),
      ),
    ),
    { initialValue: '' },
  );

  protected readonly year = computed(() => new Date().getFullYear());
  protected readonly homeLink = '/';
  /** Platform name, unless the address is one client's catalog. */
  protected readonly navName = computed(
    () => this.#clientName() || this.#i18n.t('app.platformName'),
  );
  protected readonly navInitials = computed(() => brandInitials(this.navName()));
  /** True on the confirmation screen: hide the footer, keep the public navbar intact. */
  protected readonly compactChrome = computed(() =>
    /^\/inscripcion\/[^/?#]+/.test(this.#url()),
  );
}
