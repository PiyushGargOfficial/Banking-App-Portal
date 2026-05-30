import { createSelector } from '@ngrx/store';
import { accountFeature } from './account.reducer';

export const {
  selectAccountsState,
  selectItems,
  selectLoading,
  selectSaving,
  selectClosing,
  selectError
} = accountFeature;

/** Only OPEN accounts. Useful for "open balance" tallies. */
export const selectOpenAccounts = createSelector(selectItems, (items) =>
  items.filter((a) => a.status === 'OPEN')
);

/**
 * Subtotals per currency. Returned as a plain object keyed by currency so
 * templates can iterate without fancy pipe juggling.
 */
export const selectSubtotalsByCurrency = createSelector(selectItems, (items) => {
  return items.reduce<Record<string, number>>((acc, account) => {
    if (account.status !== 'OPEN') return acc;
    acc[account.currency] = (acc[account.currency] ?? 0) + account.balance;
    return acc;
  }, {});
});

/**
 * Sum of OPEN account balances regardless of currency. We surface this for
 * the "Total balance" tile - in a real app we would FX-convert here.
 */
export const selectTotalBalance = createSelector(selectOpenAccounts, (items) =>
  items.reduce((sum, a) => sum + a.balance, 0)
);
