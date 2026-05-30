import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Validates that a value looks like a human name:
 *   - starts with a letter (any script - the \p{L} class covers accented and
 *     non-Latin characters, e.g. Renée, Müller, 李華)
 *   - followed by letters, spaces, hyphens, or apostrophes
 *
 * Allows things like "Mary-Jane", "O'Connor", "Renée Dupont" and rejects
 * digits, punctuation other than ' and -, and leading whitespace / symbols.
 *
 * Returns `null` for empty values - pair with `Validators.required` if the
 * field is mandatory.
 */
const NAME_PATTERN = /^\p{L}[\p{L} \-']*$/u;

export function nameFormatValidator(control: AbstractControl): ValidationErrors | null {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = raw.toString().trim();
  if (!value) return null;
  return NAME_PATTERN.test(value) ? null : { nameFormat: true };
}
