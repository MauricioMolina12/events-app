import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { SessionStore } from '@core/auth';
import { MESSAGES } from '@core/i18n/messages';
import { ThemeService, type ThemePreference } from '@core/ui/theme.service';
import { brandInitials, contrastText, shadeHex } from './brand-color';
import { WorkspaceApi, type WorkspaceSettings } from './workspace.api';

const BRAND_CACHE = 'events.brand';
const STOCK_TITLE = 'Barby Toys & Cupidos';

interface BrandCache {
  readonly displayName?: string;
  readonly nameCustomized?: boolean;
  readonly colorCustomized?: boolean;
  readonly primary?: string;
  readonly on?: string;
}

/**
 * Estado de marca sin depender del router ni de la sesion.
 *
 * El titulo del documento lo lee al construirse el router. Si este estado
 * pidiera la sesion, la sesion pediria el router y la aplicacion no arrancaria.
 */
@Injectable({ providedIn: 'root' })
export class BrandState {
  readonly #settings = signal<WorkspaceSettings | null>(null);
  readonly #cachedName = signal<string | null>(readBrandCache()?.displayName ?? null);
  readonly #status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly preferenceStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  readonly settings = this.#settings.asReadonly();
  readonly status = this.#status.asReadonly();
  readonly displayName = computed(
    () => this.#settings()?.displayName ?? this.#cachedName() ?? MESSAGES['app.name'],
  );
  readonly initials = computed(() => brandInitials(this.displayName()));
  readonly publicName = computed(() =>
    this.#settings()?.nameCustomized ? this.displayName() : MESSAGES['app.name'],
  );
  readonly logoUrl = computed(() => absoluteAsset(this.#settings()?.logoUrl));
  readonly markUrl = computed(() => absoluteAsset(this.#settings()?.markUrl));
  readonly nameCustomized = computed(() => this.#settings()?.nameCustomized === true);

  setStatus(status: 'idle' | 'loading' | 'ready' | 'error'): void {
    this.#status.set(status);
  }

  setSettings(settings: WorkspaceSettings | null): void {
    this.#settings.set(settings);
  }
}

/**
 * Identidad compartida del espacio y tema personal de la cuenta.
 *
 * El tema, hasta que la cuenta guarde uno, sigue siendo el de este dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  readonly #api = inject(WorkspaceApi);
  readonly #session = inject(SessionStore);
  readonly #theme = inject(ThemeService);
  readonly #brand = inject(BrandState);

  readonly settings = this.#brand.settings;
  readonly status = this.#brand.status;
  readonly displayName = this.#brand.displayName;
  readonly initials = this.#brand.initials;
  readonly publicName = this.#brand.publicName;
  readonly logoUrl = this.#brand.logoUrl;
  readonly markUrl = this.#brand.markUrl;
  readonly nameCustomized = this.#brand.nameCustomized;
  readonly preferenceStatus = this.#brand.preferenceStatus;

  #generation = 0;
  #prefsGeneration = 0;
  #prefsReady = false;
  #lastTheme: ThemePreference | null = null;

  constructor() {
    applyCachedColor();
    effect(() => {
      const settings = this.#brand.settings();
      if (settings) {
        this.#paint(settings);
      }
    });
    effect(() => {
      const status = this.#session.status();
      if (status === 'authenticated') {
        void this.#syncPreferences();
      } else if (status === 'anonymous') {
        this.#prefsReady = false;
        this.#lastTheme = null;
        this.#prefsGeneration += 1;
        this.#brand.preferenceStatus.set('idle');
      }
    });
    effect(() => {
      const preference = this.#theme.preference();
      if (!this.#prefsReady || this.#session.status() !== 'authenticated') {
        return;
      }
      if (preference === this.#lastTheme) {
        return;
      }
      void this.#persistTheme(preference);
    });
    if (typeof window !== 'undefined') {
      void this.load();
    }
  }

  load(): Promise<void> {
    const generation = ++this.#generation;
    this.#brand.setStatus('loading');
    return this.#fetch(generation);
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  /** Aplica una respuesta que acaba de guardar, descartando una lectura anterior en vuelo. */
  replace(settings: WorkspaceSettings): void {
    this.#generation += 1;
    this.#brand.setSettings(settings);
    this.#brand.setStatus('ready');
  }

  async retryTheme(): Promise<void> {
    this.#lastTheme = null;
    await this.#persistTheme(this.#theme.preference());
  }

  async #fetch(generation: number): Promise<void> {
    try {
      const settings = await firstValueFrom(this.#api.get());
      if (generation !== this.#generation) {
        return;
      }
      this.#brand.setSettings(settings);
      this.#brand.setStatus('ready');
    } catch {
      if (generation !== this.#generation) {
        return;
      }
      this.#brand.setStatus(this.#brand.settings() ? 'ready' : 'error');
    }
  }

  async #syncPreferences(): Promise<void> {
    const generation = ++this.#prefsGeneration;
    try {
      const preferences = await firstValueFrom(this.#api.preferences());
      if (generation !== this.#prefsGeneration) {
        return;
      }
      if (preferences.persisted) {
        this.#lastTheme = preferences.theme;
        this.#theme.set(preferences.theme);
      } else {
        this.#lastTheme = this.#theme.preference();
      }
      this.#prefsReady = true;
    } catch {
      if (generation !== this.#prefsGeneration) {
        return;
      }
      this.#lastTheme = this.#theme.preference();
      this.#prefsReady = true;
    }
  }

  async #persistTheme(preference: ThemePreference): Promise<void> {
    this.#brand.preferenceStatus.set('saving');
    try {
      const saved = await firstValueFrom(this.#api.saveTheme(preference));
      this.#lastTheme = saved.theme;
      this.#brand.preferenceStatus.set('saved');
    } catch {
      this.#brand.preferenceStatus.set('error');
    }
  }

  #paint(settings: WorkspaceSettings): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (!settings.colorCustomized) {
      for (const name of ['--primary', '--primary-hover', '--primary-on', '--primary-subtle', '--focus-ring']) {
        root.style.removeProperty(name);
      }
    } else {
      const on = contrastText(settings.primaryColor);
      root.style.setProperty('--primary', settings.primaryColor);
      root.style.setProperty('--primary-hover', shadeHex(settings.primaryColor, 0.86));
      root.style.setProperty('--primary-on', on);
      root.style.setProperty('--focus-ring', settings.primaryColor);
      root.style.setProperty(
        '--primary-subtle',
        `color-mix(in srgb, ${settings.primaryColor} 16%, var(--surface-1))`,
      );
    }
    writeBrandCache(settings);
    this.#favicon(absoluteAsset(settings.markUrl) ?? absoluteAsset(settings.logoUrl));
  }

  #favicon(url: string | null): void {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      return;
    }
    link.href = url ?? 'favicon.ico';
    if (url) {
      link.removeAttribute('type');
    } else {
      link.type = 'image/x-icon';
    }
  }
}

@Injectable()
export class BrandingTitleStrategy extends TitleStrategy {
  readonly #title = inject(Title);
  readonly #brand = inject(BrandState);
  #last: RouterStateSnapshot | null = null;

  constructor() {
    super();
    effect(() => {
      this.#brand.displayName();
      this.#brand.nameCustomized();
      if (this.#last) {
        this.#apply(this.#last);
      }
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.#last = snapshot;
    this.#apply(snapshot);
  }

  #apply(snapshot: RouterStateSnapshot): void {
    const built = this.buildTitle(snapshot);
    if (!built || !this.#brand.nameCustomized()) {
      this.#title.setTitle(built || this.#brand.displayName());
      return;
    }
    this.#title.setTitle(built.replaceAll(STOCK_TITLE, this.#brand.displayName()));
  }
}

function absoluteAsset(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  const base = environment.apiBaseUrl.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

function readBrandCache(): BrandCache | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(BRAND_CACHE);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as BrandCache;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function applyCachedColor(): void {
  const cached = readBrandCache();
  if (!cached?.colorCustomized || !cached.primary || typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.style.setProperty('--primary', cached.primary);
  root.style.setProperty('--primary-hover', shadeHex(cached.primary, 0.86));
  root.style.setProperty('--primary-on', cached.on ?? contrastText(cached.primary));
  root.style.setProperty('--focus-ring', cached.primary);
  root.style.setProperty(
    '--primary-subtle',
    `color-mix(in srgb, ${cached.primary} 16%, var(--surface-1))`,
  );
}

function writeBrandCache(settings: WorkspaceSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    const cache: BrandCache = {
      displayName: settings.displayName,
      nameCustomized: settings.nameCustomized,
      colorCustomized: settings.colorCustomized,
      ...(settings.colorCustomized
        ? { primary: settings.primaryColor, on: contrastText(settings.primaryColor) }
        : {}),
    };
    localStorage.setItem(BRAND_CACHE, JSON.stringify(cache));
  } catch {
    /* private mode */
  }
}
