import { HttpErrorResponse } from '@angular/common/http';
import { NETWORK_ERROR_CODE, type ErrorCode, type ValidationDetails } from './envelope';

/**
 * The single error type every store/component sees. It is built **once**, inside
 * `errorInterceptor`, so no component ever parses a raw error body.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ValidationDetails | undefined;
  readonly requestId: string | undefined;
  /** `true` when the request never reached the API (offline / DNS / CORS). */
  readonly offline: boolean;
  /** `Retry-After` header value in seconds, when the API sends one (429). */
  readonly retryAfterSeconds: number | undefined;

  constructor(init: {
    status: number;
    code: ErrorCode;
    message: string;
    details?: ValidationDetails | undefined;
    requestId?: string | undefined;
    offline?: boolean;
    retryAfterSeconds?: number | undefined;
    cause?: unknown;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    this.offline = init.offline ?? false;
    this.retryAfterSeconds = init.retryAfterSeconds;
    if (init.cause !== undefined) {
      (this as { cause?: unknown }).cause = init.cause;
    }
  }

  /** `issues` filtered for a given form field path (walking nested arrays). */
  issuesFor(path: string): readonly { readonly code: string; readonly message: string }[] {
    return (this.details?.issues ?? []).filter((issue) => issue.path === path);
  }

  /** First issue registered for a field, useful to paint a single message. */
  firstIssueFor(path: string): { readonly code: string; readonly message: string } | undefined {
    return this.issuesFor(path)[0];
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

/** Normalizes any thrown value into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (ApiError.isApiError(error)) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError({
        status: 0,
        code: NETWORK_ERROR_CODE,
        message: 'No fue posible contactar el servicio.',
        offline: true,
        cause: error,
      });
    }
    const body = extractErrorEnvelope(error);
    const retryAfter = Number(error.headers.get('Retry-After') ?? '');
    return new ApiError({
      status: error.status,
      code: body?.error?.code ?? fallbackCodeForStatus(error.status),
      message: body?.error?.message ?? error.message,
      details: body?.error?.details,
      requestId: body?.requestId ?? error.headers.get('x-request-id') ?? undefined,
      retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
      cause: error,
    });
  }
  return new ApiError({
    status: 0,
    code: NETWORK_ERROR_CODE,
    message: error instanceof Error ? error.message : 'Error inesperado.',
    cause: error,
  });
}

interface RawErrorBody {
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
    readonly details?: ValidationDetails;
  };
  readonly requestId?: string;
}

function extractErrorEnvelope(error: HttpErrorResponse): RawErrorBody | undefined {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }
  const candidate = body as RawErrorBody;
  const code = candidate.error?.code;
  if (typeof code !== 'string') {
    return undefined;
  }
  return {
    error: {
      code,
      message: candidate.error?.message ?? error.message,
      details: candidate.error?.details,
    },
    requestId: candidate.requestId,
  };
}

function fallbackCodeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'MALFORMED_JSON';
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'ROUTE_NOT_FOUND';
    case 409:
      return 'STATUS_TRANSITION_INVALID';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}
