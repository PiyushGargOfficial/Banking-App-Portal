/**
 * Audit service.
 *
 * Domain-shaped recording API. Every employee/account write call site goes
 * through a `record*` helper here, which:
 *   - generates the audit entry id and timestamp
 *   - computes a field-level diff for UPDATE actions
 *   - drops no-op UPDATE entries (no fields actually changed)
 *   - normalises the context (correlationId, actor)
 *
 * Keeping diff computation and entry shaping in the service rather than the
 * repository means the repository stays a dumb append target - and we can
 * switch from in-memory to a real DB without touching the rules.
 */
const { v4: uuid } = require('uuid');
const { MAX_PAGE_SIZE } = require('../config');
const AuditRepository = require('../repositories/audit.repository');

const nowIso = () => new Date().toISOString();

/** Fields we care about diffing for each resource. */
const EMPLOYEE_TRACKED_FIELDS = ['firstName', 'lastName', 'email', 'role', 'status'];
const ACCOUNT_TRACKED_FIELDS = ['accountType', 'currency', 'balance', 'status'];

/**
 * Build a normalised context object. We accept partial context so call
 * sites don't have to spell out the default actor every time.
 */
function ctx(context = {}) {
  return {
    actor: context.actor || 'admin',
    correlationId: context.correlationId || null
  };
}

/**
 * Compute field-level changes between two record snapshots. Only fields
 * whose values actually differ make it into the resulting array.
 */
function diff(before, after, fields) {
  const changes = [];
  for (const field of fields) {
    const b = before?.[field];
    const a = after?.[field];
    if (b !== a) changes.push({ field, before: b, after: a });
  }
  return changes;
}

/** Compose the common audit-entry fields shared across actions. */
function baseEntry({ employeeId, resource, resourceId, action, context }) {
  const { actor, correlationId } = ctx(context);
  return {
    entryId: uuid(),
    employeeId, // FK - which employee this entry belongs to
    resource, // 'Employee' | 'Account'
    resourceId, // employeeId or accountId
    action, // CREATE | UPDATE | DELETE | CLOSE | REOPEN | CASCADE_CLOSE
    actor,
    correlationId,
    timestamp: nowIso()
  };
}

const AuditService = {
  // ----- Employee --------------------------------------------------------

  recordEmployeeCreated(employee, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: employee.employeeId,
        resource: 'Employee',
        resourceId: employee.employeeId,
        action: 'CREATE',
        context
      }),
      snapshot: pick(employee, EMPLOYEE_TRACKED_FIELDS)
    });
  },

  recordEmployeeUpdated(before, after, context) {
    const changes = diff(before, after, EMPLOYEE_TRACKED_FIELDS);
    if (changes.length === 0) return null; // no-op write, don't pollute the trail
    return AuditRepository.append({
      ...baseEntry({
        employeeId: after.employeeId,
        resource: 'Employee',
        resourceId: after.employeeId,
        action: 'UPDATE',
        context
      }),
      changes
    });
  },

  recordEmployeeDeleted(employee, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: employee.employeeId,
        resource: 'Employee',
        resourceId: employee.employeeId,
        action: 'DELETE',
        context
      }),
      snapshot: pick(employee, EMPLOYEE_TRACKED_FIELDS)
    });
  },

  // ----- Account ---------------------------------------------------------

  recordAccountCreated(account, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: account.employeeId,
        resource: 'Account',
        resourceId: account.accountId,
        action: 'CREATE',
        context
      }),
      snapshot: {
        accountNumber: account.accountNumber,
        ...pick(account, ACCOUNT_TRACKED_FIELDS)
      }
    });
  },

  recordAccountUpdated(before, after, context) {
    const changes = diff(before, after, ACCOUNT_TRACKED_FIELDS);
    if (changes.length === 0) return null;
    return AuditRepository.append({
      ...baseEntry({
        employeeId: after.employeeId,
        resource: 'Account',
        resourceId: after.accountId,
        action: 'UPDATE',
        context
      }),
      changes,
      accountNumber: after.accountNumber
    });
  },

  recordAccountClosed(account, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: account.employeeId,
        resource: 'Account',
        resourceId: account.accountId,
        action: 'CLOSE',
        context
      }),
      accountNumber: account.accountNumber
    });
  },

  recordAccountReopened(account, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: account.employeeId,
        resource: 'Account',
        resourceId: account.accountId,
        action: 'REOPEN',
        context
      }),
      accountNumber: account.accountNumber
    });
  },

  /**
   * Cascade close arising from the employee being deleted. Emitted once per
   * cascaded account so the audit trail tells the full story even though
   * the parent employee row is gone afterwards.
   */
  recordAccountCascadeClosed(account, context) {
    return AuditRepository.append({
      ...baseEntry({
        employeeId: account.employeeId,
        resource: 'Account',
        resourceId: account.accountId,
        action: 'CASCADE_CLOSE',
        context
      }),
      accountNumber: account.accountNumber,
      reason: 'Owner employee deleted'
    });
  },

  // ----- Queries ---------------------------------------------------------

  /**
   * Full audit trail for an employee, newest first, optionally paginated.
   * The employee may have been deleted - the trail still resolves because
   * audit entries are append-only and never depend on a live FK row.
   */
  listForEmployee(employeeId, { page = 1, size = 50 } = {}) {
    const all = AuditRepository.findByEmployeeId(employeeId);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    // Clamp to MAX_PAGE_SIZE so a `?size=999999` request can't force the
    // server to slice + serialise an unbounded chunk of the audit log.
    // Audit trails grow forever (append-only) so this matters more here
    // than on the employee list.
    const sizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || 50));
    const start = (pageNum - 1) * sizeNum;
    return {
      items: all.slice(start, start + sizeNum),
      total: all.length,
      page: pageNum,
      size: sizeNum
    };
  }
};

// Tiny helper - selects just the named keys from `obj`.
function pick(obj, keys) {
  const out = {};
  for (const key of keys) out[key] = obj?.[key];
  return out;
}

module.exports = AuditService;
