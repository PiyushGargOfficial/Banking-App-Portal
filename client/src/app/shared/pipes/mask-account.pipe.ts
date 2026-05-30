import { Pipe, PipeTransform } from '@angular/core';

/**
 * Masks an account number, leaving the last 4 digits visible.
 * Per the assignment spec, full account numbers must not be shown in the UI.
 *
 *   '4023600099887766' -> '************7766'
 */
@Pipe({ name: 'maskAccount', standalone: true })
export class MaskAccountPipe implements PipeTransform {
  transform(value: string | null | undefined, visibleDigits = 4, maskChar = '*'): string {
    if (!value) return '';
    if (value.length <= visibleDigits) return value;
    const masked = maskChar.repeat(value.length - visibleDigits);
    return masked + value.slice(-visibleDigits);
  }
}
