import { Injectable, inject } from '@angular/core';
import { errorMessageKey } from '@core/api/error-messages';
import { toApiError, type ApiError } from '@core/api/api-error';
import { I18nService } from '@core/i18n';

/**
 * Turns an `ApiError` into something a human can read.
 *
 * It is the **only** place that resolves a code to copy, which is what keeps
 * `error.message` (server prose, unstable) out of the UI entirely.
 */
@Injectable({ providedIn: 'root' })
export class ApiErrorPresenter {
  readonly #i18n = inject(I18nService);

  message(error: unknown): string {
    const apiError = toApiError(error);
    const key = errorMessageKey(apiError.code);
    const base = this.#i18n.t(key);
    return apiError.retryAfterSeconds ? `${base} (${apiError.retryAfterSeconds}s)` : base;
  }

  /** Server-side validation issues keyed by field path, ready to paint next to inputs. */
  fieldErrors(error: unknown): Record<string, string> {
    const apiError = toApiError(error);
    const issues = apiError.details?.issues ?? [];
    const result: Record<string, string> = {};
    for (const issue of issues) {
      const path = fieldPath(issue.path);
      if (!Object.hasOwn(result, path)) {
        result[path] = issue.message;
      }
    }
    const conflictField = apiError.details?.field;
    if (conflictField) {
      const path = fieldPath(conflictField);
      if (!Object.hasOwn(result, path)) {
        result[path] = this.message(apiError);
      }
    }
    return result;
  }

  isOffline(error: unknown): boolean {
    return toApiError(error).offline;
  }

  /** Correlation id to show alongside a failure so support can trace the request. */
  supportCode(error: unknown): string | undefined {
    return toApiError(error).requestId;
  }

  isUnauthenticated(error: unknown): boolean {
    const code = toApiError(error).code;
    return code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED' || code === 'SESSION_REVOKED';
  }

  isNotFound(error: unknown): boolean {
    const error$ = toApiError(error);
    return error$.status === 404 || error$.code.endsWith('_NOT_FOUND');
  }

  asApiError(error: unknown): ApiError {
    return toApiError(error);
  }
}

/** `companions[0].documentNumber` and `companions.0.documentNumber` are the same field. */
function fieldPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}
