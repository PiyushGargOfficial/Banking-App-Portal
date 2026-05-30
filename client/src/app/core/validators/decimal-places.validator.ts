import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator factory that enforces a maximum number of digits after the
 * decimal point. Useful for currency where we want at most 2 decimals.
 *
 * Returns `null` for empty / non-numeric values so it composes with
 * `Validators.required` and `Validators.pattern` instead of double-flagging
 * the same input.
 *
 * Example: `maxDecimalPlaces(2)` rejects "10.123" but accepts "10", "10.1",
 * "10.12", and "10.10".
 */
export function maxDecimalPlaces(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || raw === '') return null;

    // Coerce to string so this works for both numeric inputs and text fields.
    const str = raw.toString();
    const dot = str.indexOf('.');
    if (dot === -1) return null;

    const fractionLen = str.length - dot - 1;
    return fractionLen > max
      ? { maxDecimalPlaces: { max, actual: fractionLen } }
      : null;
  };
}
