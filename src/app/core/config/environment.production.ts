import type { AppEnvironment } from './environment.model';

/**
 * Production environment.
 *
 * Production API is hosted by the production Worker. Keep the versioned API
 * prefix here; individual services append their endpoint paths.
 */
export const environment: AppEnvironment = {
  environmentName: 'production',
  apiBaseUrl: 'https://events-production.stargrowstudioevents.workers.dev/api/v1',
  supportUrl: 'mailto:soporte@barbytoys.example?subject=Soporte%20Eventos',
  enableDevtools: false,
  defaultTimeZone: 'America/Bogota',
  defaultLocale: 'es-CO',
  brandName: 'Barby Toys & Cupidos',
};
