import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { Observable, of } from 'rxjs';
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  Account,
  AccountCreate,
  AccountType,
  CURRENCIES,
  Currency,
  AccountStatus
} from '@core/models/account.model';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { maxDecimalPlaces } from '@core/validators/decimal-places.validator';

/**
 * Add / Edit account inline form.
 *
 * Used in two modes:
 *  - Add: no `existing` input - emits a `create` event with AccountCreate
 *  - Edit: `existing` passed in - account number is read-only, emits `update`
 *
 * Validator stack per field:
 *   accountNumber
 *     - required
 *     - pattern (8-19 digits, numeric only)
 *
 *   balance
 *     - required
 *     - min(0)                : non-negative
 *     - max(MAX_BALANCE)      : sanity cap so accidental typos don't sail through
 *     - pattern               : numeric, no scientific notation, no commas
 *     - maxDecimalPlaces(2)   : currency precision
 *
 *   accountType / currency / status (edit only)
 *     - required (selects default to a valid value, defensive anyway)
 */
const MAX_BALANCE = 9_999_999_999.99;

@Component({
  selector: 'app-account-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AsyncPipe, DecimalPipe, LoadingSpinnerComponent],
  template: `
    <form
      class="account-form"
      [formGroup]="form"
      (ngSubmit)="onSubmit()"
      novalidate
      data-cy="account-form"
      [attr.aria-label]="existing ? 'Edit account' : 'New account'"
    >
      <fieldset class="form-fieldset">
        <legend>{{ existing ? 'Account details (edit)' : 'New account details' }}</legend>
        <div class="form-grid">
          <div>
            <label for="acc-number">Account number *</label>
            <input
              id="acc-number"
              type="text"
              inputmode="numeric"
              formControlName="accountNumber"
              [readonly]="!!existing"
              maxlength="19"
              [attr.aria-invalid]="form.controls.accountNumber.touched && form.controls.accountNumber.invalid ? 'true' : null"
              [attr.aria-describedby]="form.controls.accountNumber.touched && form.controls.accountNumber.errors ? 'acc-number-error' : null"
              data-cy="acc-number"
            />
            @if (
              form.controls.accountNumber.touched && form.controls.accountNumber.errors;
              as errs
            ) {
              <div id="acc-number-error" class="field-error">
                @if (errs['required']) {
                  Account number is required.
                } @else if (errs['pattern']) {
                  Account number must be 8-19 digits with no spaces or symbols.
                }
              </div>
            }
          </div>

          <div>
            <label for="acc-type">Type *</label>
            <select
              id="acc-type"
              formControlName="accountType"
              [attr.aria-invalid]="form.controls.accountType.touched && form.controls.accountType.invalid ? 'true' : null"
              [attr.aria-describedby]="form.controls.accountType.touched && form.controls.accountType.errors ? 'acc-type-error' : null"
              data-cy="acc-type"
            >
              @for (t of types; track t) {
                <option [value]="t">{{ t }}</option>
              }
            </select>
            @if (
              form.controls.accountType.touched && form.controls.accountType.errors?.['required']
            ) {
              <div id="acc-type-error" class="field-error">Account type is required.</div>
            }
          </div>

          <div>
            <label for="acc-currency">Currency *</label>
            <select
              id="acc-currency"
              formControlName="currency"
              [attr.aria-invalid]="form.controls.currency.touched && form.controls.currency.invalid ? 'true' : null"
              [attr.aria-describedby]="form.controls.currency.touched && form.controls.currency.errors ? 'acc-currency-error' : null"
              data-cy="acc-currency"
            >
              @for (c of currencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
            @if (form.controls.currency.touched && form.controls.currency.errors?.['required']) {
              <div id="acc-currency-error" class="field-error">Currency is required.</div>
            }
          </div>

          <div>
            <label for="acc-balance">Balance *</label>
            <input
              id="acc-balance"
              type="number"
              step="0.01"
              min="0"
              [max]="MAX_BALANCE"
              formControlName="balance"
              [attr.aria-invalid]="form.controls.balance.touched && form.controls.balance.invalid ? 'true' : null"
              [attr.aria-describedby]="form.controls.balance.touched && form.controls.balance.errors ? 'acc-balance-error' : null"
              data-cy="acc-balance"
            />
            @if (form.controls.balance.touched && form.controls.balance.errors; as errs) {
              <div id="acc-balance-error" class="field-error">
                @if (errs['required']) {
                  Balance is required.
                } @else if (errs['min']) {
                  Balance cannot be negative.
                } @else if (errs['max']) {
                  Balance cannot exceed {{ MAX_BALANCE | number: '1.2-2' }}.
                } @else if (errs['pattern']) {
                  Balance must be a plain number (no commas, letters or scientific notation).
                } @else if (errs['maxDecimalPlaces']) {
                  Balance can have at most 2 decimal places.
                }
              </div>
            }
          </div>

          @if (existing) {
            <div>
              <label for="acc-status">Status *</label>
              <select
                id="acc-status"
                formControlName="status"
                [attr.aria-invalid]="form.controls.status.touched && form.controls.status.invalid ? 'true' : null"
                [attr.aria-describedby]="form.controls.status.touched && form.controls.status.errors ? 'acc-status-error' : null"
                data-cy="acc-status"
              >
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
              @if (form.controls.status.touched && form.controls.status.errors?.['required']) {
                <div id="acc-status-error" class="field-error">Status is required.</div>
              }
            </div>
          }
        </div>
      </fieldset>

      <div class="row spread mt-4">
        <span class="text-muted">* required</span>
        <div class="row">
          <button type="button" class="btn btn-ghost" (click)="cancel.emit()" data-cy="acc-cancel">
            Cancel
          </button>
          <!--
            Submit stays clickable on an invalid form so a tap surfaces every
            error at once via markAllAsTouched(). Only disable while a save
            is in flight to avoid duplicate submissions.
          -->
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="saving$ | async"
            data-cy="acc-submit"
          >
            @if (saving$ | async) {
              <app-loading-spinner [size]="14" label="Saving"></app-loading-spinner>
              Saving...
            } @else {
              {{ existing ? 'Save account' : 'Add account' }}
            }
          </button>
        </div>
      </div>
    </form>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .account-form {
        padding: 16px;
        background: var(--color-bg);
        border-radius: var(--radius-md);
      }
      @media (max-width: 480px) {
        .account-form {
          padding: 12px;
        }
      }
    `
  ]
})
export class AccountFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  /** When provided, the form runs in edit mode. */
  @Input() existing?: Account | null = null;
  /** Stream the parent passes in so the submit button can show progress. */
  @Input() saving$: Observable<boolean> = of(false);

  @Output() create = new EventEmitter<AccountCreate>();
  @Output() update = new EventEmitter<{
    accountType: AccountType;
    currency: Currency;
    balance: number;
    status: AccountStatus;
  }>();
  @Output() cancel = new EventEmitter<void>();

  protected readonly types = ACCOUNT_TYPES;
  protected readonly currencies = CURRENCIES;
  protected readonly statuses = ACCOUNT_STATUSES;
  /** Exposed for the template's max attribute + error message. */
  protected readonly MAX_BALANCE = MAX_BALANCE;

  protected readonly form = this.fb.nonNullable.group({
    accountNumber: ['', [Validators.required, Validators.pattern(/^\d{8,19}$/)]],
    accountType: ['CHECKING' as AccountType, [Validators.required]],
    currency: ['CAD' as Currency, [Validators.required]],
    balance: [
      0,
      [
        Validators.required,
        Validators.min(0),
        Validators.max(MAX_BALANCE),
        Validators.pattern(/^\d+(\.\d+)?$/),
        maxDecimalPlaces(2)
      ]
    ],
    status: ['OPEN' as AccountStatus, [Validators.required]]
  });

  ngOnInit(): void {
    this.applyExisting();
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existing']) this.applyExisting();
  }

  private applyExisting(): void {
    if (this.existing) {
      this.form.patchValue({
        accountNumber: this.existing.accountNumber,
        accountType: this.existing.accountType,
        currency: this.existing.currency,
        balance: this.existing.balance,
        status: this.existing.status
      });
    }
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.getRawValue();
    if (this.existing) {
      this.update.emit({
        accountType: v.accountType,
        currency: v.currency,
        balance: Number(v.balance),
        status: v.status
      });
    } else {
      this.create.emit({
        accountNumber: v.accountNumber,
        accountType: v.accountType,
        currency: v.currency,
        balance: Number(v.balance)
      });
    }
  }
}
