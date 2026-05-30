/**
 * Test helper: reset every collection in the in-memory store.
 *
 * Each unit test calls this in beforeEach so it runs against a clean
 * database. Mutating the arrays in place (not reassigning the module
 * exports) keeps the same array reference any other module already holds,
 * so repositories don't end up reading a stale snapshot.
 */
const store = require('../../data/store');

function resetStore() {
  store.employees.length = 0;
  store.accounts.length = 0;
  store.auditLog.length = 0;
}

module.exports = { resetStore };
