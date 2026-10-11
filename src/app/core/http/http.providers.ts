import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders } from '@angular/core';
import { baseUrlInterceptor } from './base-url.interceptor';
import { errorInterceptor } from './error.interceptor';
import { requestIdInterceptor } from './request-id.interceptor';
import { retryInterceptor } from './retry.interceptor';

/**
 * HTTP stack, wired once. Order matters: the response travels back through the
 * interceptors in reverse, so `retry` sits closest to the network (it must see the
 * raw failure) and `error` normalizes only the final outcome.
 */
export function provideAppHttp(): EnvironmentProviders {
  return provideHttpClient(
    withFetch(),
    withInterceptors([
      baseUrlInterceptor,
      requestIdInterceptor,
      errorInterceptor,
      retryInterceptor,
    ]),
  );
}
