import { FormControl, FormGroup, Validators, type AbstractControl, type FormArray } from '@angular/forms';
import type { RegistrationCompanionRequest } from '@core/domain';
import type { I18nService } from '@core/i18n';
import { isValidDocumentInput, type DocumentType } from '@core/utils/documents';

/**
 * Companion rows, shared by the alta and by "agregar acompañante": both send the same shape
 * and the server validates both with the same schema, so the client rules live once.
 */

export type CompanionForm = FormGroup<{
  documentType: FormControl<DocumentType>;
  documentNumber: FormControl<string>;
  fullName: FormControl<string>;
}>;

export const MIN_NAME_LENGTH = 3;

/** Emptiness is `Validators.required`'s business, not this validator's. */
export function documentValidator(control: AbstractControl): { document: true } | null {
  const value = (control.value as string | null) ?? '';
  if (value.trim().length === 0) {
    return null;
  }
  return isValidDocumentInput(value) ? null : { document: true };
}

export function companionGroup(): CompanionForm {
  return new FormGroup({
    documentType: new FormControl<DocumentType>('CC', { nonNullable: true }),
    documentNumber: new FormControl('', { nonNullable: true, validators: [documentValidator] }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_NAME_LENGTH)],
    }),
  });
}

/**
 * Rows with no data at all are dropped: they are collateral of the "add" button, not data.
 * A row with any value travels as it is (the server validates the rest).
 */
export function companionRequests(
  companions: FormArray<CompanionForm>,
): RegistrationCompanionRequest[] {
  return companions
    .getRawValue()
    .filter(
      (companion) =>
        companion.fullName.trim().length > 0 || companion.documentNumber.trim().length > 0,
    )
    .map((companion) => ({
      fullName: companion.fullName.trim(),
      documentType: companion.documentNumber.trim() ? companion.documentType : null,
      documentNumber: companion.documentNumber.trim() || null,
    }));
}

/** The first local validator a control fails, translated. */
export function validationMessage(control: AbstractControl, i18n: I18nService): string | undefined {
  const errors = control.errors;
  if (!errors) {
    return undefined;
  }
  if (errors['required']) {
    return i18n.t('validation.required');
  }
  if (errors['email']) {
    return i18n.t('validation.email');
  }
  if (errors['phone']) {
    return i18n.t('validation.phone');
  }
  if (errors['document']) {
    return i18n.t('validation.document');
  }
  if (errors['minlength']) {
    const minLength = errors['minlength'] as { requiredLength?: number };
    return i18n.t('validation.minLength', { count: minLength.requiredLength ?? 0 });
  }
  if (errors['maxlength']) {
    const maxLength = errors['maxlength'] as { requiredLength?: number };
    return i18n.t('validation.maxLength', { count: maxLength.requiredLength ?? 0 });
  }
  return i18n.t('errors.validation');
}
