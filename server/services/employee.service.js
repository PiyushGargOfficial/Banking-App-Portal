/**
 * Employee service.
 *
 * Encodes the business rules of the employee domain on top of the pure-CRUD
 * repositories. Responsibilities:
 *   - generate primary keys (uuid) and timestamps on writes
 *   - apply domain defaults (status -> ACTIVE)
 *   - cross-aggregate orchestration: cascade soft-close of accounts when
 *     an employee is deleted, hasAccounts filter when listing
 *   - emit audit-log entries for every meaningful write
 *   - paginate / sort / filter the list query
 *
 * Controllers depend on this service; the service depends on repositories.
 * Controllers must NOT reach into a repository directly - that would skip
 * the rules above (including audit logging).
 *
 * Every write method accepts an optional `context = { correlationId, actor }`
 * argument which is forwarded to the audit service. Controllers populate it
 * from `req.correlationId`.
 */
const { v4: uuid } = require('uuid');
const { MAX_PAGE_SIZE } = require('../config');
const EmployeeRepository = require('../repositories/employee.repository');
const AccountRepository = require('../repositories/account.repository');
const AuditService = require('./audit.service');

const nowIso = () => new Date().toISOString();

/**
 * Emit the full model to the server log on a write. Kept here (not in the
 * controller) because this is where the persisted model is fully formed -
 * with generated id, defaults applied and timestamps set. The correlation id
 * is included so the line ties back to the matching morgan HTTP access line.
 */
const logModel = (action, model, context) => {
  const cid = context?.correlationId || 'n/a';
  console.log(`[employee] ${action} cid=${cid}\n${JSON.stringify(model, null, 2)}`);
};

const EmployeeService = {
  // --- Queries -------------------------------------------------------------

  findById(employeeId) {
    return EmployeeRepository.findById(employeeId);
  },

  isEmailTaken(email, excludeId) {
    return EmployeeRepository.isEmailTaken(email, excludeId);
  },

  /**
   * Paginated / filtered / sorted listing.
   *
   * The `hasAccounts` filter is the cross-aggregate concern that justifies
   * keeping the list query on the service: it consults the account
   * repository for the set of employee ids that own at least one account.
   */
  list({
    search = '',
    role = '',
    status = '',
    hasAccounts = '',
    sortBy = 'lastName',
    sortDir = 'asc',
    page = 1,
    size = 10
  } = {}) {
    const term = search.toString().toLowerCase();
    let result = EmployeeRepository.findAll();

    if (term) {
      result = result.filter(
        (e) =>
          e.firstName.toLowerCase().includes(term) ||
          e.lastName.toLowerCase().includes(term) ||
          e.email.toLowerCase().includes(term)
      );
    }
    if (role) result = result.filter((e) => e.role === role);
    if (status) result = result.filter((e) => e.status === status);

    if (hasAccounts === 'with' || hasAccounts === 'without') {
      const idsWithAccounts = AccountRepository.getEmployeeIdsWithAccounts();
      result = result.filter((e) =>
        hasAccounts === 'with'
          ? idsWithAccounts.has(e.employeeId)
          : !idsWithAccounts.has(e.employeeId)
      );
    }

    // Sort - stable comparator on a copied array.
    const dir = sortDir === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = (a[sortBy] ?? '').toString().toLowerCase();
      const bv = (b[sortBy] ?? '').toString().toLowerCase();
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
    });

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    // Clamp size to MAX_PAGE_SIZE so a caller asking for ?size=999999 can't
    // force the server to slice + serialise the entire collection. The
    // response's `size` field reflects the clamped value, so the client can
    // see they got fewer items than requested.
    const sizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || 10));
    const start = (pageNum - 1) * sizeNum;
    return {
      items: result.slice(start, start + sizeNum),
      total: result.length,
      page: pageNum,
      size: sizeNum
    };
  },

  // --- Commands ------------------------------------------------------------

  create({ firstName, lastName, email, role, status }, context) {
    const employee = {
      employeeId: uuid(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      role,
      status: status || 'ACTIVE', // domain default
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    EmployeeRepository.insert(employee);
    AuditService.recordEmployeeCreated(employee, context);
    logModel('CREATE', employee, context);
    return employee;
  },

  replace(employeeId, { firstName, lastName, email, role, status }, context) {
    // Snapshot the row before the write so the audit diff is accurate.
    const before = EmployeeRepository.findById(employeeId);
    if (!before) return null;
    const after = EmployeeRepository.update(employeeId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      role,
      status,
      updatedAt: nowIso()
    });
    AuditService.recordEmployeeUpdated(before, after, context);
    logModel('UPDATE', after, context);
    return after;
  },

  patch(employeeId, patch, context) {
    const before = EmployeeRepository.findById(employeeId);
    if (!before) return null;
    const after = EmployeeRepository.update(employeeId, { ...patch, updatedAt: nowIso() });
    AuditService.recordEmployeeUpdated(before, after, context);
    logModel('UPDATE', after, context);
    return after;
  },

  /**
   * Delete + cascade soft-close.
   *
   * Business rule: removing an employee must not leave dangling OPEN
   * accounts. Rather than hard-deleting the accounts (and losing audit
   * history) we flip their status to CLOSED.
   *
   * The audit trail captures three kinds of entry:
   *   1. one DELETE for the employee themselves
   *   2. one CASCADE_CLOSE per account that was actually OPEN at the time
   *      (we don't re-close already-CLOSED accounts in the audit narrative)
   */
  remove(employeeId, context) {
    const employee = EmployeeRepository.findById(employeeId);
    if (!employee) return false;

    // Snapshot the accounts that are about to be cascade-closed.
    const accountsToClose = AccountRepository.findByEmployeeId(employeeId)
      .filter((a) => a.status === 'OPEN')
      .map((a) => ({ ...a }));

    EmployeeRepository.deleteById(employeeId);
    AccountRepository.updateAllByEmployeeId(employeeId, {
      status: 'CLOSED',
      updatedAt: nowIso()
    });

    AuditService.recordEmployeeDeleted(employee, context);
    for (const acc of accountsToClose) {
      AuditService.recordAccountCascadeClosed(acc, context);
    }
    return true;
  }
};

module.exports = EmployeeService;
