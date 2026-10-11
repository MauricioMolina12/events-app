import type { AppEnvironment } from './environment.model';

/**
 * Build publicado en Vercel.
 *
 * Apunta al Worker de development: esa sesión ya viaja con `SameSite=None`,
 * así el panel en otro dominio puede enviar la cookie. El API de producción
 * usa `SameSite=Lax` y no aceptaría el login desde Vercel.
 */
export const environment: AppEnvironment = {
  environmentName: 'development',
  apiBaseUrl: 'https://events-development.stargrowstudioevents.workers.dev/api/v1',
  supportUrl: 'mailto:soporte@barbytoys.example?subject=Soporte%20Eventos',
  enableDevtools: false,
  defaultTimeZone: 'America/Bogota',
  defaultLocale: 'es-CO',
  brandName: 'Barby Toys & Cupidos',
};
