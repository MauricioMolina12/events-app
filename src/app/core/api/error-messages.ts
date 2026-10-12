import { NETWORK_ERROR_CODE, type ErrorCode } from './envelope';
import type { MessageKey } from '@core/i18n/messages';

/**
 * The **single** table mapping `error.code` → i18n key. Every screen that shows an
 * API failure goes through this map (directly or via `ApiErrorPresenter`), which
 * keeps `error.message` out of the decision path as the contract requires.
 */
export const ERROR_MESSAGE_KEYS = {
  VALIDATION_ERROR: 'errors.validation',
  MALFORMED_JSON: 'errors.malformedJson',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  LOGO_INVALID: 'errors.logoInvalid',
  ROUTE_NOT_FOUND: 'errors.routeNotFound',
  UNAUTHENTICATED: 'errors.unauthenticated',
  SESSION_EXPIRED: 'errors.sessionExpired',
  SESSION_REVOKED: 'errors.sessionRevoked',
  ACCOUNT_DISABLED: 'errors.accountDisabled',
  INVALID_CREDENTIALS: 'errors.invalidCredentials',
  ACCOUNT_LOCKED: 'errors.accountLocked',
  FORBIDDEN: 'errors.forbidden',
  EVENT_NOT_FOUND: 'errors.eventNotFound',
  ESTABLISHMENT_NOT_FOUND: 'errors.establishmentNotFound',
  PARTICIPATION_NOT_FOUND: 'errors.participationNotFound',
  REGISTRATION_NOT_FOUND: 'errors.registrationNotFound',
  USER_NOT_FOUND: 'errors.userNotFound',
  EVENT_NOT_REGISTRABLE: 'errors.eventNotRegistrable',
  PARTICIPATION_CLOSED: 'errors.participationClosed',
  PARTICIPATION_ALREADY_EXISTS: 'errors.participationAlreadyExists',
  PARTICIPATION_HAS_REGISTRATIONS: 'errors.participationHasRegistrations',
  REGISTRATION_OUTSIDE_WINDOW: 'errors.registrationOutsideWindow',
  TITULAR_CAPACITY_EXCEEDED: 'errors.titularCapacityExceeded',
  COMPANION_CAPACITY_EXCEEDED: 'errors.companionCapacityExceeded',
  COMPANION_LIMIT_REACHED: 'errors.companionLimitReached',
  TICKET_NOT_FOUND: 'errors.ticketNotFound',
  QR_REVOKED: 'errors.qrRevoked',
  QR_MALFORMED: 'errors.qrMalformed',
  TURN_ASSIGNMENT_CONFLICT: 'errors.turnAssignmentConflict',
  CHECK_IN_HOLDER_ABSENT: 'errors.checkInHolderAbsent',
  DUPLICATE_DOCUMENT: 'errors.duplicateDocument',
  DUPLICATE_REGISTRATION: 'errors.duplicateRegistration',
  REGISTRATION_ALREADY_CANCELLED: 'errors.registrationAlreadyCancelled',
  EMAIL_ALREADY_USED: 'errors.emailAlreadyUsed',
  EVENT_SLUG_ALREADY_USED: 'errors.eventSlugAlreadyUsed',
  EVENT_CAPACITY_EXCEEDED: 'errors.eventCapacityExceeded',
  ESTABLISHMENT_CODE_ALREADY_USED: 'errors.establishmentCodeAlreadyUsed',
  LAST_ADMIN_PROTECTED: 'errors.lastAdminProtected',
  STATUS_TRANSITION_INVALID: 'errors.statusTransitionInvalid',
  CAPACITY_ADJUSTMENT_REQUIRED: 'errors.capacityAdjustmentRequired',
  RATE_LIMITED: 'errors.rateLimited',
  DATABASE_UNAVAILABLE: 'errors.databaseUnavailable',
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  INTERNAL_ERROR: 'errors.internalError',
  [NETWORK_ERROR_CODE]: 'errors.network',
} as const satisfies Record<string, MessageKey>;

const FALLBACK_MESSAGE_KEY: MessageKey = 'errors.unknown';

/** Resolves an error code to its message key, tolerating unknown future codes. */
export function errorMessageKey(code: ErrorCode | undefined): MessageKey {
  if (code && Object.hasOwn(ERROR_MESSAGE_KEYS, code)) {
    return ERROR_MESSAGE_KEYS[code as keyof typeof ERROR_MESSAGE_KEYS];
  }
  return FALLBACK_MESSAGE_KEY;
}
