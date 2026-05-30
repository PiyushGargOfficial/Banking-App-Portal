/**
 * Account controller.
 *
 * Same layering rule as the employee controller: only ever imports from
 * services/, never from repositories/ or data/. Decisions made here are
 * HTTP-shaped (status codes, response bodies, header semantics).
 *
 * Employee existence checks happen here rather than in the account service
 * because they're a "does this request even make sense" concern - the
 * service exists to enforce account rules, not to defend against missing
 * parent rows.
 */
const AccountService = require('../services/account.service');
const EmployeeService = require('../services/employee.service');
const accountValidator = require('../validators/account.validator');
const { problem } = require('../utils/problem-details');
const { sanitizeObject } = require('../utils/sanitize');

/** Build the audit context the services forward to AuditService. */
const auditContext = (req) => ({
  correlationId: req.correlationId,
  actor: 'admin'
});

/** GET /api/employees/:id/accounts */
exports.listForEmployee = (req, res) => {
  if (!EmployeeService.findById(req.params.id)) {
    return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  }
  res.json(AccountService.listForEmployee(req.params.id));
};

/** POST /api/employees/:id/accounts */
exports.createForEmployee = (req, res) => {
  if (!EmployeeService.findById(req.params.id)) {
    return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  }

  const body = sanitizeObject(req.body);
  const errors = accountValidator.validateCreate(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  if (AccountService.isAccountNumberTaken(body.accountNumber)) {
    return res.status(409).json(problem(409, 'Conflict', 'Account number is already in use'));
  }

  const account = AccountService.create(
    req.params.id,
    {
      ...body,
      balance: body.balance === undefined || body.balance === '' ? 0 : Number(body.balance)
    },
    auditContext(req)
  );
  res.status(201).json(account);
};

/** GET /api/accounts/:accountId */
exports.getById = (req, res) => {
  const account = AccountService.findById(req.params.accountId);
  if (!account) return res.status(404).json(problem(404, 'Not Found', 'Account not found'));
  res.json(account);
};

/** PUT /api/accounts/:accountId */
exports.replace = (req, res) => {
  const body = sanitizeObject(req.body);
  const errors = accountValidator.validateReplace(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  const updated = AccountService.replace(
    req.params.accountId,
    {
      accountType: body.accountType,
      currency: body.currency,
      balance: Number(body.balance),
      status: body.status
    },
    auditContext(req)
  );
  if (!updated) return res.status(404).json(problem(404, 'Not Found', 'Account not found'));
  res.json(updated);
};

/** PATCH /api/accounts/:accountId - partial update. */
exports.patch = (req, res) => {
  const body = sanitizeObject(req.body);
  const { errors, patch } = accountValidator.validatePatch(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  const updated = AccountService.patch(req.params.accountId, patch, auditContext(req));
  if (!updated) return res.status(404).json(problem(404, 'Not Found', 'Account not found'));
  res.json(updated);
};

/** DELETE /api/accounts/:accountId - soft close lives on the service. */
exports.close = (req, res) => {
  const closed = AccountService.close(req.params.accountId, auditContext(req));
  if (!closed) return res.status(404).json(problem(404, 'Not Found', 'Account not found'));
  res.json(closed);
};
