import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  formatDocument,
  isValidDocumentInput,
  normalizeDocument,
} from './documents';

describe('normalizeDocument', () => {
  it('uppercases and drops every non A-Z0-9 character', () => {
    expect(normalizeDocument('1.020.304.000')).toBe('1020304000');
    expect(normalizeDocument(' cc-12 34 ')).toBe('CC1234');
    expect(normalizeDocument('900.123.456-7')).toBe('9001234567');
  });
});

describe('isValidDocumentInput', () => {
  it('accepts 4 to 30 normalized characters', () => {
    expect(isValidDocumentInput('123')).toBe(false);
    expect(isValidDocumentInput('1.020')).toBe(true);
    expect(isValidDocumentInput('1'.repeat(30))).toBe(true);
    expect(isValidDocumentInput('1'.repeat(31))).toBe(false);
  });
});

describe('formatDocument', () => {
  it('groups the NIT body in thousands and keeps the verifier digit', () => {
    expect(formatDocument('900123456-7', 'NIT')).toBe('900.123.456-7');
  });

  it('leaves a single-digit NIT untouched', () => {
    expect(formatDocument('7', 'NIT')).toBe('7');
  });

  it('returns the raw normalized value for the other document types', () => {
    expect(formatDocument('1.020.304.000', 'CC')).toBe('1020304000');
  });
});

describe('documentTypeLabel', () => {
  it('labels every type the forms offer', () => {
    for (const type of DOCUMENT_TYPES) {
      expect(documentTypeLabel(type)).toBeTruthy();
    }
  });

  it('uses the Colombian acronyms', () => {
    expect(documentTypeLabel('CC')).toBe('Cédula de ciudadanía');
    expect(documentTypeLabel('CE')).toBe('Cédula de extranjería');
    expect(documentTypeLabel('NIT')).toBe('NIT');
  });
});
