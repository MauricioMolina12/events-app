import type { Routes } from '@angular/router';
import { PublicShell } from '@layout/public-shell/public-shell';

/**
 * Route table.
 *
 * `title` is a plain string: it is read by the router, not by a template, so it can't go
 * through the i18n catalog. The app is single-language today (es-CO), so that is fine.
 *
 * Every feature is `loadComponent`-lazy so the first paint only ships the shell; the
 * public catalogue is the only thing an anonymous visitor ever downloads.
 */
export const appRoutes: Routes = [
  {
    path: 'panel',
    loadChildren: () => import('@features/panel/panel.routes').then((m) => m.panelRoutes),
  },
  {
    path: '',
    component: PublicShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'eventos' },
      {
        path: 'eventos',
        title: 'Eventos · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/event-list-page/event-list-page').then((m) => m.EventListPage),
      },
      {
        path: 'eventos/:slug',
        title: 'Evento · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/event-detail-page/event-detail-page').then(
            (m) => m.EventDetailPage,
          ),
      },
      {
        path: 'eventos/:slug/inscripcion',
        title: 'Inscripción · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/registration-page/registration-page').then(
            (m) => m.RegistrationPage,
          ),
      },
      {
        path: 'eventos/:slug/acompanantes',
        title: 'Agregar acompañante · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/add-companions-page/add-companions-page').then(
            (m) => m.AddCompanionsPage,
          ),
      },
      {
        /** Same page without an event in the path: the titular picks it (`?evento=` presets it). */
        path: 'acompanantes',
        title: 'Agregar acompañante · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/add-companions-page/add-companions-page').then(
            (m) => m.AddCompanionsPage,
          ),
      },
      {
        /**
         * Public entry point for a shared link. It resolves the event (and the sede) and hands
         * over to the canonical form below, so the URL that is pasted into WhatsApp or an email
         * is short and the form itself keeps a single address. No guard on purpose: the
         * catalogue and the alta are the anonymous surface of the API.
         */
        path: 'inscripcion',
        title: 'Inscripción · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/registration-entry-page/registration-entry-page').then(
            (m) => m.RegistrationEntryPage,
          ),
      },
      {
        path: 'inscripcion/:id',
        title: 'Comprobante · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/catalog/receipt-page/receipt-page').then((m) => m.ReceiptPage),
      },
      {
        path: '**',
        title: 'No encontrado · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/errors/not-found-page/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
