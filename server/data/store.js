/**
 * In-memory data store.
 *
 * Three collections are shared mutable state across the repository layer.
 * Repositories own the read/write access; nothing else in the codebase
 * touches this module directly.
 *
 * `auditLog` is append-only by convention - the audit repository never
 * exposes update or delete operations on it.
 *
 * Restarting the process resets the database to the seeded shape, which is
 * exactly what we want for a mock backend.
 */
const { employees: seedEmployees, accounts: seedAccounts } = require('./seed');

module.exports = {
  employees: [...seedEmployees],
  accounts: [...seedAccounts],
  auditLog: []
};
