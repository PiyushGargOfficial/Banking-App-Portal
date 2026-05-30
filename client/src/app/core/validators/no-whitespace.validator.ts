import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Rejects strings that are non-empty but contain only whitespace.
 *
 * `Validators.required` treats "   " as valid (it has length > 0) which is
 * almost never what you want for names/labels. This validator paired with
 * `required` covers both "empty" and "all spaces" cases.
 *
 * Returns `null` for genuinely empty values so it composes cleanly with
 * `required` instead of duplicating the same error.
 */
export function noWhitespaceValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  return value.trim().length === 0 ? { whitespaceOnly: true } : null;
}
