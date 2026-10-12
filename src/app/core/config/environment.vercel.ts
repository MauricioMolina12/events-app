import type { AppEnvironment } from './environment.model';

/**
 * Build publicado en Vercel.
 *
 * La API se pide en el mismo origen (`/api/v1`). Vercel reenvía ese path al
 * Worker. Si el navegador hablara directo con `workers.dev`, Safari (iPhone)
 * descartaría la cookie de sesión por ser de otro sitio y el login no entraría.
 */
export const environment: AppEnvironment = {
  environmentName: 'development',
  apiBaseUrl: '/api/v1',
  supportUrl: 'mailto:soporte@barbytoys.example?subject=Soporte%20Eventos',
  enableDevtools: false,
  defaultTimeZone: 'America/Bogota',
  defaultLocale: 'es-CO',
  brandName: 'Barby Toys & Cupidos',
};
