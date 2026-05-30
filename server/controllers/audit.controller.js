/**
 * Audit controller.
 *
 * Read-only: there are no write endpoints because audit entries are
 * append-only and emitted by the employee/account services on their
 * behalf. Exposing a "create audit entry" route would invite tampering.
 *
 * The list endpoint deliberately does NOT 404 on a missing employee:
 * audit history outlives the live row (an employee can be deleted and
 * their trail still resolves), and "no entries" is a legitimate response
 * for any never-touched id.
 */
const AuditService = require('../services/audit.service');

/** GET /api/employees/:id/audit?page=&size= */
exports.listForEmployee = (req, res) => {
  const response = AuditService.listForEmployee(req.params.id, req.query);
  res.json(response);
};
