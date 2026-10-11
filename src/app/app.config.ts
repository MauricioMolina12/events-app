import { OverlayModule } from '@angular/cdk/overlay';
import {
  ApplicationConfig,
  LOCALE_ID,
  importProvidersFrom,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { SessionStore } from '@core/auth';
import { provideAppHttp } from '@core/http';
import { ThemeService } from '@core/ui/theme.service';
import { BrandingTitleStrategy, WorkspaceService } from '@core/workspace/workspace.service';
import { appRoutes } from './app.routes';

// `DatePipe` / `CurrencyPipe` need the locale data registered once, before bootstrap.
registerLocaleData(localeEsCo, 'es-CO');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-CO' },

    provideRouter(
      appRoutes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),

    provideAppHttp(),
    importProvidersFrom(OverlayModule),

    { provide: TitleStrategy, useClass: BrandingTitleStrategy },

    provideAppInitializer(() => {
      inject(ThemeService);
      inject(WorkspaceService);
      void inject(SessionStore).load();
    }),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // `registerWhenStable:<timeout>` — register after the first paint, but never let a
      // long-running task block registration forever.
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
