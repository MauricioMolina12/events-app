/**
 * Registration (alta) mirrored from `events-api`.
 *
 * A registration always belongs to a **participation** (event + sede), never to the
 * event alone: capacity and the inscription window are per sede, so the sede is what
 * the caller must pick before filling in the form.
 *
 * The alta is deliberately flat — one titular plus an optional list of companions —
 * because that is the shape of the arrival sheet and of the paper form being replaced.
 */

/** Mirrors the server's `DOCUMENT_TYPES`; display labels live in `@core/utils/documents`. */
export type DocumentType = 'CC' | 'TI' | 'CE' | 'PA' | 'RC' | 'NIT';

export const DOCUMENT_TYPES: readonly DocumentType[] = ['CC', 'TI', 'CE', 'PA', 'RC', 'NIT'];

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled';

export type RegistrationSource = 'public' | 'admin';

/**
 * Mirrors the server's `COMPANIONS_MAX`. Kept here so the form stops the user before
 * the request does; the API still validates it (client validation is never trusted).
 */
export const MAX_COMPANIONS_PER_REGISTRATION = 2;

/** One companion as sent inside the alta. Document data is optional. */
export interface RegistrationCompanionRequest {
  readonly fullName: string;
  readonly documentType?: DocumentType | null;
  readonly documentNumber?: string | null;
}

/** Body of `POST /public/registrations` (and of the admin alta). */
export interface CreateRegistrationRequest {
  readonly participationId: string;
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly fullName: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  /** Whether the titular asked for an electronic invoice. Stored only, for now. */
  readonly requiresElectronicInvoice?: boolean;
  readonly companions?: readonly RegistrationCompanionRequest[];
}

/** Body of `POST /registrations/{id}/cancel`. */
export interface CancelRegistrationRequest {
  readonly reason: string;
}

/** `GET /registrations` — panel listing. */
export interface Registration {
  readonly id: string;
  readonly participationId: string;
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly requiresElectronicInvoice: boolean;
  readonly companionsCount: number;
  readonly status: RegistrationStatus;
  readonly source: RegistrationSource;
  readonly registeredAt: string;
  readonly cancelledAt: string | null;
  readonly cancelledReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Companion row returned by `GET /registrations/{id}`. */
export interface RegistrationCompanion {
  readonly id: string;
  readonly fullName: string;
  readonly documentType: DocumentType | null;
  readonly documentNumber: string | null;
  readonly createdAt: string;
}

/** `GET /registrations/{id}` — registration plus its companions. */
export interface RegistrationDetail extends Registration {
  readonly companions: readonly RegistrationCompanion[];
}

/**
 * Answer of `POST /public/registrations` and of the folio lookup
 * (`GET /public/registrations/{id}`).
 *
 * It is the only thing the client may keep for the receipt: no contact data, no
 * companions' documents. The full row is panel business.
 */
export interface PublicRegistrationReceipt {
  readonly id: string;
  readonly participationId: string;
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly fullName: string;
  readonly companionsCount: number;
  readonly status: RegistrationStatus;
  readonly registeredAt: string;
  /**
   * Opaque pass token. Present on `POST /public/registrations` so this device can
   * draw the QR; the folio lookup does not send it again (only the hash is stored).
   */
  readonly qrToken?: string;
}

/**
 * How the titular proves an alta is theirs without an account: the event (slug or id), the
 * document they registered with and the email they gave. A mismatch is a plain 404.
 */
export interface HolderCredentials {
  readonly event: string;
  readonly documentType: DocumentType;
  readonly documentNumber: string;
  readonly email: string;
}

/** Body of `POST /public/registrations/companions`. */
export interface AddCompanionsRequest extends HolderCredentials {
  readonly companions: readonly RegistrationCompanionRequest[];
}

/** Answer of the titular lookup and of the companion append: the receipt plus the cap. */
export interface PublicHolderRegistration extends PublicRegistrationReceipt {
  readonly maxCompanions: number;
}
