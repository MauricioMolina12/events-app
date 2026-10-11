import type { AppEnvironment } from './environment.model';

export type { AppEnvironment };

/**
 * Development environment.
 *
 * Development API is hosted by the development Worker. Keep the versioned API
 * prefix here; individual services append their endpoint paths.
 */
export const environment: AppEnvironment = {
  environmentName: 'development',
  apiBaseUrl: 'https://events-development.stargrowstudioevents.workers.dev/api/v1',
  supportUrl: 'mailto:soporte@barbytoys.example?subject=Soporte%20Eventos',
  enableDevtools: true,
  defaultTimeZone: 'America/Bogota',
  defaultLocale: 'es-CO',
  brandName: 'Barby Toys & Cupidos',
};
