import { Pipe, PipeTransform } from '@angular/core';
import { Currency } from '@core/models/account.model';

/**
 * Currency formatting helper that mirrors Intl.NumberFormat but keeps the
 * call site short (`{{ balance | money: currency }}`). Built-in Angular pipe
 * could be used, but a thin wrapper lets us standardise locale + fraction
 * digits across the app and stay consistent under tests.
 */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, currency: Currency | string = 'CAD'): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
}
