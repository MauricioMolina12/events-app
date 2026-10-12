/**
 * Wire types of the `events-api` envelope. These mirror `/api/v1/openapi.json`
 * by hand (the backend does not share its Zod schemas with the client).
 *
 * Envelopes are the only shape the transport layer knows about: the rest of the
 * app talks in domain types returned by `ApiClient`.
 */

export interface PageMeta {
  /** Total rows matching the current filters. */
  readonly total: number;
  /** Limit **actually applied** by the server (may be lower than requested). */
  readonly limit: number;
  /** Offset **actually applied** by the server. */
  readonly offset: number;
}

export interface ApiEnvelope<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: PageMeta;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly meta: PageMeta;
}

export type ValidationTarget = 'json' | 'query' | 'param';

export interface ValidationIssue {
  /** Dot-path to the offending field, e.g. `companions.0.fullName`. */
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ValidationDetails {
  readonly target?: ValidationTarget;
  readonly issues?: readonly ValidationIssue[];
  /** Conflict payloads (`DUPLICATE_DOCUMENT`) point at the offending form path. */
  readonly field?: string;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: ValidationDetails;
  };
  readonly requestId?: string;
}

/**
 * Stable, public error codes. Branch on these — never on `message`.
 * Extra codes are tolerated (`string & {}`) so a newer backend cannot break the
 * build, but the known union keeps autocompletion and exhaustive switches useful.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'ROUTE_NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'ACCOUNT_DISABLED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'FORBIDDEN'
  | 'EVENT_NOT_FOUND'
  | 'ESTABLISHMENT_NOT_FOUND'
  | 'PARTICIPATION_NOT_FOUND'
  | 'REGISTRATION_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'EVENT_NOT_REGISTRABLE'
  | 'PARTICIPATION_CLOSED'
  | 'PARTICIPATION_ALREADY_EXISTS'
  | 'PARTICIPATION_HAS_REGISTRATIONS'
  | 'REGISTRATION_OUTSIDE_WINDOW'
  | 'TITULAR_CAPACITY_EXCEEDED'
  | 'COMPANION_CAPACITY_EXCEEDED'
  | 'COMPANION_LIMIT_REACHED'
  | 'TICKET_NOT_FOUND'
  | 'QR_REVOKED'
  | 'QR_MALFORMED'
  | 'TURN_ASSIGNMENT_CONFLICT'
  | 'CHECK_IN_HOLDER_ABSENT'
  | 'DUPLICATE_DOCUMENT'
  | 'DUPLICATE_REGISTRATION'
  | 'REGISTRATION_ALREADY_CANCELLED'
  | 'EMAIL_ALREADY_USED'
  | 'EVENT_SLUG_ALREADY_USED'
  | 'EVENT_CAPACITY_EXCEEDED'
  | 'ESTABLISHMENT_CODE_ALREADY_USED'
  | 'LAST_ADMIN_PROTECTED'
  | 'STATUS_TRANSITION_INVALID'
  | 'CAPACITY_ADJUSTMENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'DATABASE_UNAVAILABLE'
  | 'SERVICE_UNAVAILABLE'
  | 'LOGO_INVALID'
  | 'INTERNAL_ERROR'
  | (string & Record<never, never>);

/** Transport-level code used when the request never reached the API. */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR' as const;
