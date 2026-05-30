/**
 * Account repository.
 *
 * Pure CRUD against the in-memory store. Same rules as the employee
 * repository - no timestamps, no business rules, no HTTP awareness.
 *
 * One method here is intentionally "bulk-friendly": updateAllByEmployeeId.
 * It powers the cascade-soft-close behaviour from the employee service, but
 * the *decision* to cascade lives there - the repo just exposes the
 * operation that makes that decision implementable in a single pass over
 * the store.
 */
const store = require('../data/store');

const AccountRepository = {
  findAll() {
    return store.accounts;
  },

  findById(accountId) {
    return store.accounts.find((a) => a.accountId === accountId) || null;
  },

  findByEmployeeId(employeeId) {
    return store.accounts.filter((a) => a.employeeId === employeeId);
  },

  isAccountNumberTaken(accountNumber) {
    return store.accounts.some((a) => a.accountNumber === accountNumber);
  },

  /**
   * Cross-aggregate query used by the employee list's `hasAccounts` filter.
   *
   * Returns a Set so the caller can do O(1) lookups per employee instead
   * of a nested loop. Kept on the account side because that's where the
   * underlying data lives.
   */
  getEmployeeIdsWithAccounts() {
    return new Set(store.accounts.map((a) => a.employeeId));
  },

  insert(account) {
    store.accounts.push(account);
    return account;
  },

  update(accountId, updates) {
    const idx = store.accounts.findIndex((a) => a.accountId === accountId);
    if (idx === -1) return null;
    store.accounts[idx] = { ...store.accounts[idx], ...updates };
    return store.accounts[idx];
  },

  /**
   * Apply the same `updates` to every account belonging to an employee.
   * Returns the number of rows touched. Used by the employee service's
   * cascade-soft-close on delete.
   */
  updateAllByEmployeeId(employeeId, updates) {
    let count = 0;
    store.accounts = store.accounts.map((a) => {
      if (a.employeeId !== employeeId) return a;
      count += 1;
      return { ...a, ...updates };
    });
    return count;
  }
};

module.exports = AccountRepository;
