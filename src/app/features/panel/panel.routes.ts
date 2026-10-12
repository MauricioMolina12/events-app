import type { Routes } from '@angular/router';
import { authGuard, publicOnlyGuard, roleGuard } from '@core/auth';

export const panelRoutes: Routes = [
  {
    path: 'signup',
    title: 'Crear cuenta · Star Grow Studio',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('@features/panel/signup-page/signup-page').then((m) => m.PanelSignupPage),
  },
  {
    path: 'login',
    title: 'Ingreso · Star Grow Studio',
    canMatch: [publicOnlyGuard],
    loadComponent: () =>
      import('@features/panel/login-page/login-page').then((m) => m.PanelLoginPage),
  },
  {
    path: '',
    loadComponent: () =>
      import('@features/panel/panel-shell/panel-shell').then((m) => m.PanelShell),
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Dashboard · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        data: { wide: true },
        loadComponent: () =>
          import('@features/panel/dashboard/dashboard-page/dashboard-page').then(
            (m) => m.DashboardPage,
          ),
      },
      {
        path: 'forbidden',
        title: 'Sin permisos · Panel · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/errors/forbidden-page/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: 'mesa',
        title: 'Mesa de registro · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import(
            '@features/panel/registration-desk/registration-desk-page/registration-desk-page'
          ).then((m) => m.RegistrationDeskPage),
      },
      {
        path: 'ingreso',
        title: 'Ingreso y turnos · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import('@features/panel/check-in/check-in-page/check-in-page').then(
            (m) => m.CheckInPage,
          ),
      },
      { path: 'events', pathMatch: 'full', redirectTo: 'eventos' },
      {
        path: 'eventos',
        pathMatch: 'full',
        title: 'Eventos · Panel · Barby Toys & Cupidos',
        loadComponent: () =>
          import('@features/panel/events/event-list-page/event-list-page').then(
            (m) => m.EventListPage,
          ),
      },
      {
        path: 'eventos/nuevo',
        title: 'Nuevo evento · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@features/panel/events/event-form-page/event-form-page').then(
            (m) => m.EventFormPage,
          ),
      },
      {
        path: 'eventos/:id/editar',
        title: 'Editar evento · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import('@features/panel/events/event-form-page/event-form-page').then(
            (m) => m.EventFormPage,
          ),
      },
      { path: 'establishments', pathMatch: 'full', redirectTo: 'sedes' },
      {
        path: 'sedes',
        pathMatch: 'full',
        title: 'Sedes · Panel · Barby Toys & Cupidos',
        loadComponent: () =>
          import(
            '@features/panel/establishments/establishment-list-page/establishment-list-page'
          ).then((m) => m.EstablishmentListPage),
      },
      {
        path: 'sedes/nueva',
        title: 'Nueva sede · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import(
            '@features/panel/establishments/establishment-form-page/establishment-form-page'
          ).then((m) => m.EstablishmentFormPage),
      },
      {
        path: 'sedes/:id/editar',
        title: 'Editar sede · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import(
            '@features/panel/establishments/establishment-form-page/establishment-form-page'
          ).then((m) => m.EstablishmentFormPage),
      },
      {
        path: 'cupos',
        title: 'Cupos · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import('@features/panel/quotas/quotas-page/quotas-page').then((m) => m.QuotasPage),
      },
      {
        path: 'usuarios',
        title: 'Usuarios · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('@features/panel/users/users-page/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'colaboradores',
        title: 'Colaboradores · Panel · Star Grow Studio',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import('@features/panel/collaborators/collaborators-page/collaborators-page').then(
            (m) => m.CollaboratorsPage,
          ),
      },
      {
        path: 'configuracion',
        title: 'Configuración · Panel · Barby Toys & Cupidos',
        canActivate: [roleGuard('admin', 'operator')],
        loadComponent: () =>
          import('@features/panel/settings/settings-page/settings-page').then((m) => m.SettingsPage),
      },
      { path: '**', redirectTo: '' },
    ],
  },
  { path: '**', redirectTo: '' },
];
