/**
 * Employee repository.
 *
 * Pure CRUD against the in-memory store. Knows about rows and columns,
 * nothing about timestamps, defaults, business rules or HTTP. A repository
 * method should be replaceable by an equivalent SQL/Mongo/whatever call
 * with no change at the calling site.
 *
 * Composition: services use repositories. Controllers DO NOT - they only
 * talk to services. If you find yourself importing a repository from a
 * controller, that's a signal the logic belongs in a service instead.
 */
const store = require('../data/store');

const EmployeeRepository = {
  /** Return every employee row. Caller must not mutate the returned array. */
  findAll() {
    return store.employees;
  },

  findById(employeeId) {
    return store.employees.find((e) => e.employeeId === employeeId) || null;
  },

  /**
   * Email lookup with optional id exclusion (used by the unique-email check
   * during edit, where the employee's own row shouldn't count as a clash).
   */
  findByEmail(email, excludeId) {
    const lower = email.toLowerCase();
    return (
      store.employees.find(
        (e) => e.email.toLowerCase() === lower && e.employeeId !== excludeId
      ) || null
    );
  },

  isEmailTaken(email, excludeId) {
    return !!this.findByEmail(email, excludeId);
  },

  /** Append a fully-formed row. The caller owns id + timestamp generation. */
  insert(employee) {
    store.employees.push(employee);
    return employee;
  },

  /**
   * Merge `updates` into the existing row by id. Returns the updated row
   * or null if no row matched. Equally suited to PUT (full body) and PATCH
   * (subset) - the layer above decides which fields to pass.
   */
  update(employeeId, updates) {
    const idx = store.employees.findIndex((e) => e.employeeId === employeeId);
    if (idx === -1) return null;
    store.employees[idx] = { ...store.employees[idx], ...updates };
    return store.employees[idx];
  },

  deleteById(employeeId) {
    const idx = store.employees.findIndex((e) => e.employeeId === employeeId);
    if (idx === -1) return false;
    store.employees.splice(idx, 1);
    return true;
  }
};

module.exports = EmployeeRepository;
