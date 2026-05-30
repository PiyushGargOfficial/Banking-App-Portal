/**
 * Audit repository.
 *
 * Append-only by design: this module deliberately does NOT expose update
 * or delete operations. Audit history must never be retroactively edited -
 * that's the whole point of having one.
 *
 * Reads are scoped to an employee (their full trail, including audit
 * entries about their accounts) or to a single resource (e.g. one account).
 * Results are returned in reverse-chronological order so the most recent
 * change always lands at the top of the UI.
 */
const store = require('../data/store');

const AuditRepository = {
  /** Append a fully-formed audit entry. Caller owns id + timestamp. */
  append(entry) {
    store.auditLog.push(entry);
    return entry;
  },

  /**
   * Every audit entry tied to a given employee, newest first. Includes
   * entries whose `resource` is 'Account' but whose parent employee is the
   * one queried - so the employee's profile-level trail covers everything
   * that happened on their accounts too.
   */
  findByEmployeeId(employeeId) {
    return store.auditLog
      .filter((entry) => entry.employeeId === employeeId)
      .slice()
      .reverse();
  },

  /** All entries that name a specific resource id (employee or account). */
  findByResourceId(resourceId) {
    return store.auditLog
      .filter((entry) => entry.resourceId === resourceId)
      .slice()
      .reverse();
  }
};

module.exports = AuditRepository;
