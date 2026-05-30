// Account contract. Each Employee can own 0..N accounts.

import { EmployeeId } from './employee.model';

export type AccountType = 'CHECKING' | 'SAVINGS';
export type AccountStatus = 'OPEN' | 'CLOSED';
export type Currency = 'CAD' | 'USD';

export interface Account {
  /** Primary key of this account record. */
  accountId: string;
  /**
   * Foreign key reference back to {@link Employee.employeeId}.
   *
   * Declared as {@link EmployeeId} (imported from employee.model) rather
   * than inlining `string` so the FK relationship is explicit at the type
   * level: this column points at an Employee row, not just any random
   * identifier. If the Employee primary-key shape ever changes, this field
   * picks up the new type automatically.
   */
  employeeId: EmployeeId;
  accountNumber: string;
  accountType: AccountType;
  currency: Currency;
  balance: number;
  status: AccountStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload used to create a new account for an employee. */
export interface AccountCreate {
  accountNumber: string;
  accountType: AccountType;
  currency: Currency;
  balance: number;
}

/** Payload used by PATCH for partial updates. */
export interface AccountPatch {
  accountType?: AccountType;
  status?: AccountStatus;
  currency?: Currency;
  balance?: number;
}

export const ACCOUNT_TYPES: AccountType[] = ['CHECKING', 'SAVINGS'];
export const ACCOUNT_STATUSES: AccountStatus[] = ['OPEN', 'CLOSED'];
export const CURRENCIES: Currency[] = ['CAD', 'USD'];
