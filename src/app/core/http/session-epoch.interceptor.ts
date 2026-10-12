import type { HttpInterceptorFn } from '@angular/common/http';
import { SESSION_EPOCH, currentSessionEpoch } from '@core/auth/session-epoch';

/** Anota la petición con la época de sesión vigente al enviarla. */
export const sessionEpochInterceptor: HttpInterceptorFn = (request, next) => {
  return next(request.clone({ context: request.context.set(SESSION_EPOCH, currentSessionEpoch()) }));
};
