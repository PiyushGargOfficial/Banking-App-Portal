import { Account } from '@core/models/account.model';
import {
  selectOpenAccounts,
  selectSubtotalsByCurrency,
  selectTotalBalance
} from './account.selectors';

/**
 * Selector spec for the composed (derived) account selectors.
 *
 * These power the "Total balance" tile and per-currency subtotals, so getting
 * them wrong shows up as wrong money on screen. We test the `.projector`
 * functions directly - that's the pure derivation logic, isolated from the
 * store wiring (which @ngrx generates and is not ours to re-test).
 *
 * The important business rule baked into all three: CLOSED accounts are
 * excluded from every tally.
 */
const acc = (overrides: Partial<Account> = {}): Account => ({
  accountId: 'a',
  employeeId: 'e1',
  accountNumber: '4023600000000001',
  accountType: 'CHECKING',
  currency: 'CAD',
  balance: 100,
  status: 'OPEN',
  ...overrides
});

describe('selectOpenAccounts', () => {
  it('returns only OPEN accounts', () => {
    const items = [
      acc({ accountId: '1', status: 'OPEN' }),
      acc({ accountId: '2', status: 'CLOSED' }),
      acc({ accountId: '3', status: 'OPEN' })
    ];
    const open = selectOpenAccounts.projector(items);
    expect(open.map((a) => a.accountId)).toEqual(['1', '3']);
  });

  it('returns an empty array when nothing is open', () => {
    expect(selectOpenAccounts.projector([acc({ status: 'CLOSED' })])).toEqual([]);
  });
});

describe('selectSubtotalsByCurrency', () => {
  it('sums OPEN balances grouped by currency', () => {
    const items = [
      acc({ accountId: '1', currency: 'CAD', balance: 100 }),
      acc({ accountId: '2', currency: 'CAD', balance: 50 }),
      acc({ accountId: '3', currency: 'USD', balance: 25 })
    ];
    expect(selectSubtotalsByCurrency.projector(items)).toEqual({ CAD: 150, USD: 25 });
  });

  it('excludes CLOSED accounts from the subtotals', () => {
    const items = [
      acc({ accountId: '1', currency: 'CAD', balance: 100, status: 'OPEN' }),
      acc({ accountId: '2', currency: 'CAD', balance: 999, status: 'CLOSED' })
    ];
    expect(selectSubtotalsByCurrency.projector(items)).toEqual({ CAD: 100 });
  });

  it('returns an empty object when there are no accounts', () => {
    expect(selectSubtotalsByCurrency.projector([])).toEqual({});
  });
});

describe('selectTotalBalance', () => {
  it('sums OPEN balances across all currencies into one number', () => {
    // selectTotalBalance derives from selectOpenAccounts, so its projector
    // receives the already-filtered OPEN accounts.
    const openAccounts = [
      acc({ accountId: '1', currency: 'CAD', balance: 100 }),
      acc({ accountId: '2', currency: 'USD', balance: 50 })
    ];
    expect(selectTotalBalance.projector(openAccounts)).toBe(150);
  });

  it('is zero when there are no open accounts', () => {
    expect(selectTotalBalance.projector([])).toBe(0);
  });
});
