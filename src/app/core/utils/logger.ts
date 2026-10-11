import { environment } from '@env/environment';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimal, dependency-free logger. `console` is banned by ESLint (`no-console`) so
 * the only allowed call sites are here; debug noise is dropped in production and
 * personal data (documents, emails) must never be passed in.
 */
export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (environment.enableDevtools) {
      emit('debug', message, context);
    }
  },
  info(message: string, context?: Record<string, unknown>): void {
    emit('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    emit('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>): void {
    emit('error', message, context);
  },
};

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const payload = context ? ` ${JSON.stringify(context)}` : '';
  // eslint-disable-next-line no-console
  console[level](`[events-f] ${message}${payload}`);
}
