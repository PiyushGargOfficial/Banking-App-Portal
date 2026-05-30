/**
 * Employee controller.
 *
 * Translates HTTP requests into service calls and shapes the response.
 *
 * Strict layering:
 *   - imports from services/ only (never repositories/, never data/)
 *   - holds zero business rules and zero data-access logic
 *   - decides status codes, sanitises input, dispatches validation
 */
const EmployeeService = require('../services/employee.service');
const employeeValidator = require('../validators/employee.validator');
const { problem } = require('../utils/problem-details');
const { sanitizeObject } = require('../utils/sanitize');

/**
 * Build the audit context object that services forward to AuditService.
 * Once we wire authentication, `actor` becomes `req.user.id`.
 */
const auditContext = (req) => ({
  correlationId: req.correlationId,
  actor: 'admin'
});

/** GET /api/employees */
exports.list = (req, res) => {
  const response = EmployeeService.list(req.query);
  res.json(response);
};

/** GET /api/employees/email-available - async validator helper. */
exports.emailAvailable = (req, res) => {
  const email = (req.query.email || '').toString();
  const excludeId = (req.query.excludeId || '').toString();
  if (!email) return res.json({ available: false });
  res.json({ available: !EmployeeService.isEmailTaken(email, excludeId) });
};

/** GET /api/employees/:id */
exports.getById = (req, res) => {
  const employee = EmployeeService.findById(req.params.id);
  if (!employee) return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  res.json(employee);
};

/** POST /api/employees */
exports.create = (req, res) => {
  const body = sanitizeObject(req.body);
  const errors = employeeValidator.validateCreate(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  if (EmployeeService.isEmailTaken(body.email)) {
    return res.status(409).json(problem(409, 'Conflict', 'Email is already in use'));
  }
  const employee = EmployeeService.create(body, auditContext(req));
  res.status(201).json(employee);
};

/** PUT /api/employees/:id */
exports.replace = (req, res) => {
  const body = sanitizeObject(req.body);
  const errors = employeeValidator.validateReplace(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  if (EmployeeService.isEmailTaken(body.email, req.params.id)) {
    return res.status(409).json(problem(409, 'Conflict', 'Email is already in use'));
  }
  const updated = EmployeeService.replace(req.params.id, body, auditContext(req));
  if (!updated) return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  res.json(updated);
};

/** PATCH /api/employees/:id - partial update. */
exports.patch = (req, res) => {
  const body = sanitizeObject(req.body);
  const { errors, patch } = employeeValidator.validatePatch(body);
  if (errors.length) {
    return res
      .status(400)
      .json(problem(400, 'Validation Failed', 'One or more fields are invalid', { errors }));
  }
  if (patch.email !== undefined && EmployeeService.isEmailTaken(patch.email, req.params.id)) {
    return res.status(409).json(problem(409, 'Conflict', 'Email is already in use'));
  }
  const updated = EmployeeService.patch(req.params.id, patch, auditContext(req));
  if (!updated) return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  res.json(updated);
};

/** DELETE /api/employees/:id - cascade soft-close of accounts happens in the service. */
exports.remove = (req, res) => {
  const removed = EmployeeService.remove(req.params.id, auditContext(req));
  if (!removed) return res.status(404).json(problem(404, 'Not Found', 'Employee not found'));
  res.status(204).end();
};
