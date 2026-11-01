import type { AppEnvironment } from './environment.model';

/**
 * Production environment.
 *
 * The browser calls `/api/v1` on the same site that serves the app. The host
 * forwards that path to the production Worker. A direct `workers.dev` address
 * would drop the session cookie.
 */
export const environment: AppEnvironment = {
  environmentName: 'production',
  apiBaseUrl: '/api/v1',
  supportUrl: 'mailto:soporte@barbytoys.example?subject=Soporte%20Eventos',
  enableDevtools: false,
  defaultTimeZone: 'America/Bogota',
  defaultLocale: 'es-CO',
  brandName: 'Barby Toys & Cupidos',
};
