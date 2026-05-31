/**
 * Account service.
 *
 * Business rules for accounts on top of the pure-CRUD account repository.
 * Responsibilities:
 *   - generate primary keys (uuid) and timestamps on writes
 *   - apply domain defaults (status -> OPEN, balance -> 0)
 *   - implement "close" / "reopen" as named status flips, not deletes
 *   - emit audit-log entries for every meaningful write
 *
 * Every write method accepts an optional `context = { correlationId, actor }`
 * argument used by the audit hooks. Controllers populate it from
 * `req.correlationId`.
 */
const { v4: uuid } = require('uuid');
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
  console.log(`[account] ${action} cid=${cid}\n${JSON.stringify(model, null, 2)}`);
};

const AccountService = {
  // --- Queries -------------------------------------------------------------

  findById(accountId) {
    return AccountRepository.findById(accountId);
  },

  listForEmployee(employeeId) {
    return AccountRepository.findByEmployeeId(employeeId);
  },

  isAccountNumberTaken(accountNumber) {
    return AccountRepository.isAccountNumberTaken(accountNumber);
  },

  // --- Commands ------------------------------------------------------------

  create(employeeId, { accountNumber, accountType, currency, balance }, context) {
    const account = {
      accountId: uuid(),
      employeeId,
      accountNumber,
      accountType,
      currency,
      balance: balance ?? 0, // domain default
      status: 'OPEN', // domain default
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    AccountRepository.insert(account);
    AuditService.recordAccountCreated(account, context);
    logModel('CREATE', account, context);
    return account;
  },

  replace(accountId, { accountType, currency, balance, status }, context) {
    const before = AccountRepository.findById(accountId);
    if (!before) return null;
    const after = AccountRepository.update(accountId, {
      accountType,
      currency,
      balance,
      status,
      updatedAt: nowIso()
    });
    AuditService.recordAccountUpdated(before, after, context);
    logModel('UPDATE', after, context);
    return after;
  },

  /**
   * Partial update. Two patches need a specific audit narrative:
   *   - status: 'CLOSED' -> a Close entry (more readable than "status diff")
   *   - status: 'OPEN' on a CLOSED row -> a Reopen entry
   * Anything else falls back to the generic UPDATE diff path.
   */
  patch(accountId, patch, context) {
    const before = AccountRepository.findById(accountId);
    if (!before) return null;
    const after = AccountRepository.update(accountId, { ...patch, updatedAt: nowIso() });

    const isOnlyStatusFlip =
      Object.keys(patch).length === 1 &&
      patch.status !== undefined &&
      patch.status !== before.status;

    if (isOnlyStatusFlip && patch.status === 'CLOSED') {
      AuditService.recordAccountClosed(after, context);
    } else if (isOnlyStatusFlip && patch.status === 'OPEN') {
      AuditService.recordAccountReopened(after, context);
    } else {
      AuditService.recordAccountUpdated(before, after, context);
    }
    logModel('UPDATE', after, context);
    return after;
  },

  /**
   * Soft close - the dedicated path called from DELETE /api/accounts/:id.
   *
   * The business rule is "we never hard-delete an account record", so the
   * service exposes a named `close` operation that the controller calls
   * (mapped from HTTP DELETE). The repository sees nothing more than a
   * generic status update - it doesn't know the difference between this
   * and any other field tweak, which is exactly the kind of ignorance we
   * want at that layer.
   */
  close(accountId, context) {
    const before = AccountRepository.findById(accountId);
    if (!before) return null;
    const after = AccountRepository.update(accountId, {
      status: 'CLOSED',
      updatedAt: nowIso()
    });
    AuditService.recordAccountClosed(after, context);
    logModel('CLOSE', after, context);
    return after;
  }
};

module.exports = AccountService;
