/**
 * The type itself is domain data and is declared in `@core/domain`; it is re-exported
 * here so callers that only need formatting helpers keep a single import.
 */
import type { DocumentType } from '@core/domain';

export type { DocumentType };
export { DOCUMENT_TYPES } from '@core/domain';

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  CE: 'Cédula de extranjería',
  PA: 'Pasaporte',
  RC: 'Registro civil',
  NIT: 'NIT',
};

export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_LABELS[type];
}

/**
 * Same normalization the API applies: trim, uppercase and drop anything that is
 * not `A-Z0-9`. `1.020.304.000` and `1020304000` collapse to the same value.
 * The server stays the source of truth; this is for search and duplicate hints.
 */
export function normalizeDocument(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidDocumentInput(value: string): boolean {
  const normalized = normalizeDocument(value);
  return normalized.length >= 4 && normalized.length <= 30;
}

/** Presentation-only formatting; never send this to the API. */
export function formatDocument(value: string, type: DocumentType): string {
  const normalized = normalizeDocument(value);
  if (type === 'NIT' && normalized.length > 1) {
    const body = normalized.slice(0, -1);
    const verifier = normalized.slice(-1);
    return `${groupThousands(body)}-${verifier}`;
  }
  return normalized;
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
