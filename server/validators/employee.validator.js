/**
 * Employee request-body validators.
 *
 * Each function returns an array of { field, message } errors. An empty array
 * means "valid". Controllers can check `errors.length` and decide whether to
 * call the model or return a 400.
 *
 * Validation is split from the model so the same rules can be reused across
 * POST and PUT - they share most of the schema but differ in a few details.
 */
const {
  isValidEmail,
  isValidName,
  isValidEmployeeRole,
  isValidEmployeeStatus
} = require('./common');

/**
 * Validate the payload for POST /api/employees.
 * Status is optional on create (defaults to ACTIVE in the model).
 */
function validateCreate(body) {
  const errors = [];

  if (!body.firstName) {
    errors.push({ field: 'firstName', message: 'First name is required' });
  } else if (!isValidName(body.firstName)) {
    errors.push({
      field: 'firstName',
      message: 'First name must be 2-60 letters (spaces, hyphens, apostrophes allowed)'
    });
  }

  if (!body.lastName) {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  } else if (!isValidName(body.lastName)) {
    errors.push({
      field: 'lastName',
      message: 'Last name must be 2-60 letters (spaces, hyphens, apostrophes allowed)'
    });
  }

  if (!isValidEmail(body.email)) {
    errors.push({ field: 'email', message: 'Valid email (max 120 characters) is required' });
  }
  if (!isValidEmployeeRole(body.role)) {
    errors.push({ field: 'role', message: 'Role must be ADMIN, SUPPORT or MANAGER' });
  }
  if (body.status && !isValidEmployeeStatus(body.status)) {
    errors.push({ field: 'status', message: 'Status must be ACTIVE or INACTIVE' });
  }

  return errors;
}

/** Validate the payload for PUT /api/employees/:id (status is required). */
function validateReplace(body) {
  const errors = validateCreate(body);
  if (!isValidEmployeeStatus(body.status)) {
    errors.push({ field: 'status', message: 'Status must be ACTIVE or INACTIVE' });
  }
  return errors;
}

/**
 * Validate the payload for PATCH /api/employees/:id. Only the fields present
 * in the body are checked, since PATCH is partial by definition.
 */
function validatePatch(body) {
  const errors = [];
  const allowed = ['firstName', 'lastName', 'email', 'role', 'status'];
  const patch = {};
  for (const key of allowed) if (body[key] !== undefined) patch[key] = body[key];

  if (patch.firstName !== undefined && !isValidName(patch.firstName)) {
    errors.push({ field: 'firstName', message: 'First name format is invalid' });
  }
  if (patch.lastName !== undefined && !isValidName(patch.lastName)) {
    errors.push({ field: 'lastName', message: 'Last name format is invalid' });
  }
  if (patch.email !== undefined && !isValidEmail(patch.email)) {
    errors.push({ field: 'email', message: 'Email is invalid' });
  }
  if (patch.role !== undefined && !isValidEmployeeRole(patch.role)) {
    errors.push({ field: 'role', message: 'Role is invalid' });
  }
  if (patch.status !== undefined && !isValidEmployeeStatus(patch.status)) {
    errors.push({ field: 'status', message: 'Status is invalid' });
  }

  return { errors, patch };
}

module.exports = { validateCreate, validateReplace, validatePatch };
