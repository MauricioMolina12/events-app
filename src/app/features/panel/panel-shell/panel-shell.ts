import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SessionStore } from '@core/auth';
import { TranslatePipe } from '@core/i18n';
import type { MessageKey } from '@core/i18n/messages';
import { storage } from '@core/utils/local-storage';
import { WorkspaceService } from '@core/workspace/workspace.service';
import {
  BrandMark,
  Icon,
  Menu,
  MenuContentDirective,
  MenuTriggerDirective,
  ThemeToggle,
  TooltipDirective,
  type IconName,
} from '@shared/ui';

const SIDEBAR_KEY = 'panel.sidebarCollapsed';

export interface PanelNavigationItem {
  readonly label: MessageKey;
  readonly shortLabel: MessageKey;
  readonly icon: IconName;
  readonly route?: string;
  readonly exact?: boolean;
}

export function panelSectionTitle(url: string): MessageKey {
  const path = url.split('?')[0] ?? url;
  if (path.startsWith('/panel/mesa')) {
    return 'nav.panel.registrations';
  }
  if (path.startsWith('/panel/ingreso')) {
    return 'nav.panel.checkIn';
  }
  if (path.startsWith('/panel/eventos/nuevo')) {
    return 'events.form.create';
  }
  if (/\/panel\/eventos\/[^/]+\/editar/.test(path)) {
    return 'events.form.edit';
  }
  if (path.startsWith('/panel/eventos')) {
    return 'nav.panel.events';
  }
  if (path.startsWith('/panel/sedes/nueva')) {
    return 'establishments.form.create';
  }
  if (/\/panel\/sedes\/[^/]+\/editar/.test(path)) {
    return 'establishments.form.edit';
  }
  if (path.startsWith('/panel/sedes')) {
    return 'nav.panel.establishments';
  }
  if (path.startsWith('/panel/configuracion')) {
    return 'nav.panel.settings';
  }
  if (path.startsWith('/panel/forbidden')) {
    return 'app.forbidden.title';
  }
  return 'nav.panel.dashboard';
}

export function isPanelTabActive(url: string, route: string): boolean {
  const path = url.split('?')[0] ?? url;
  if (route === '/panel') {
    return path === '/panel' || path === '/panel/';
  }
  return path === route || path.startsWith(`${route}/`);
}

@Component({
  selector: 'app-panel-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    Icon,
    BrandMark,
    ThemeToggle,
    Menu,
    MenuContentDirective,
    MenuTriggerDirective,
    TooltipDirective,
  ],
  templateUrl: './panel-shell.html',
  styleUrl: './panel-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class PanelShell {
  readonly #session = inject(SessionStore);
  readonly #router = inject(Router);
  protected readonly workspace = inject(WorkspaceService);

  protected readonly collapsed = signal(storage.read<boolean>(SIDEBAR_KEY) === true);
  protected readonly moreOpen = signal(false);
  protected readonly user = this.#session.user;
  protected readonly isAdmin = this.#session.isAdmin;

  /** Pages that declare `data: { wide: true }` (the dashboard) get a wider content column. */
  protected readonly wide = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.#isWide()),
    ),
    { initialValue: this.#isWide() },
  );

  protected readonly url = toSignal(
    this.#router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.#router.url },
  );

  protected readonly titleKey = computed(() => panelSectionTitle(this.url()));

  protected readonly primaryNav: readonly PanelNavigationItem[] = [
    {
      label: 'nav.panel.dashboard',
      shortLabel: 'nav.tab.dashboard',
      icon: 'monitor',
      route: '/panel',
      exact: true,
    },
    {
      label: 'nav.panel.registrations',
      shortLabel: 'nav.tab.desk',
      icon: 'inbox',
      route: '/panel/mesa',
    },
    {
      label: 'nav.panel.checkIn',
      shortLabel: 'nav.tab.checkIn',
      icon: 'scan',
      route: '/panel/ingreso',
    },
    {
      label: 'nav.panel.events',
      shortLabel: 'nav.tab.events',
      icon: 'calendar',
      route: '/panel/eventos',
    },
  ];

  protected readonly workspaceModules: readonly PanelNavigationItem[] = [
    {
      label: 'nav.panel.establishments',
      shortLabel: 'nav.panel.establishments',
      icon: 'map-pin',
      route: '/panel/sedes',
    },
    {
      label: 'nav.panel.settings',
      shortLabel: 'nav.panel.settings',
      icon: 'settings',
      route: '/panel/configuracion',
    },
  ];

  protected readonly adminModules: readonly PanelNavigationItem[] = [
    { label: 'nav.panel.participations', shortLabel: 'nav.panel.participations', icon: 'ticket' },
    { label: 'nav.panel.users', shortLabel: 'nav.panel.users', icon: 'users' },
  ];

  protected readonly tabs: readonly PanelNavigationItem[] = [
    ...this.primaryNav,
    { label: 'nav.panel.more', shortLabel: 'nav.tab.more', icon: 'more-horizontal' },
  ];

  protected toggleSidebar(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    storage.write(SIDEBAR_KEY, next);
  }

  protected toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }

  protected onEscape(): void {
    if (this.moreOpen()) {
      this.moreOpen.set(false);
    }
  }

  protected tabActive(item: PanelNavigationItem): boolean {
    if (!item.route) {
      return this.moreOpen() || isPanelTabActive(this.url(), '/panel/sedes');
    }
    return isPanelTabActive(this.url(), item.route);
  }

  protected onTab(item: PanelNavigationItem): void {
    if (!item.route) {
      this.toggleMore();
      return;
    }
    this.closeMore();
    void this.#router.navigateByUrl(item.route);
  }

  protected onSheetNavigate(): void {
    this.closeMore();
  }

  protected async logout(): Promise<void> {
    this.closeMore();
    await this.#session.logout();
    await this.#router.navigateByUrl('/panel/login', { replaceUrl: true });
  }

  #isWide(): boolean {
    let route = this.#router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.data['wide'] === true;
  }
}
