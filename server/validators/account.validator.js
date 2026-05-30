/**
 * Account request-body validators.
 *
 * Same shape as the employee validators - functions return an array of
 * { field, message } errors. PATCH returns both the errors and the cleaned
 * patch object since some PATCH fields need numeric coercion.
 */
const { MAX_BALANCE } = require('../config');
const {
  isValidAccountType,
  isValidAccountStatus,
  isValidBalance,
  isValidCurrency
} = require('./common');

const ACCOUNT_NUMBER_PATTERN = /^\d{8,19}$/;
const balanceMessage =
  `Balance must be a non-negative number with at most 2 decimal places, up to ${MAX_BALANCE}`;

/** Validate the payload for POST /api/employees/:id/accounts. */
function validateCreate(body) {
  const errors = [];

  if (!body.accountNumber) {
    errors.push({ field: 'accountNumber', message: 'Account number is required' });
  } else if (!ACCOUNT_NUMBER_PATTERN.test(body.accountNumber)) {
    errors.push({
      field: 'accountNumber',
      message: 'Account number must be 8-19 digits with no spaces or symbols'
    });
  }

  if (!isValidAccountType(body.accountType)) {
    errors.push({ field: 'accountType', message: 'Account type must be CHECKING or SAVINGS' });
  }
  if (!isValidCurrency(body.currency)) {
    errors.push({ field: 'currency', message: 'Currency must be CAD or USD' });
  }

  // Balance is optional on create (defaults to 0 in the model).
  if (body.balance !== undefined && body.balance !== '' && !isValidBalance(body.balance)) {
    errors.push({ field: 'balance', message: balanceMessage });
  }

  return errors;
}

/** Validate the payload for PUT /api/accounts/:accountId. */
function validateReplace(body) {
  const errors = [];

  if (!isValidAccountType(body.accountType)) {
    errors.push({ field: 'accountType', message: 'Account type must be CHECKING or SAVINGS' });
  }
  if (!isValidCurrency(body.currency)) {
    errors.push({ field: 'currency', message: 'Currency must be CAD or USD' });
  }
  if (!isValidAccountStatus(body.status)) {
    errors.push({ field: 'status', message: 'Status must be OPEN or CLOSED' });
  }
  if (!isValidBalance(body.balance)) {
    errors.push({ field: 'balance', message: balanceMessage });
  }

  return errors;
}

/** Validate the payload for PATCH /api/accounts/:accountId. */
function validatePatch(body) {
  const errors = [];
  const allowed = ['accountType', 'status', 'currency', 'balance'];
  const patch = {};
  for (const key of allowed) if (body[key] !== undefined) patch[key] = body[key];

  if (patch.accountType !== undefined && !isValidAccountType(patch.accountType)) {
    errors.push({ field: 'accountType', message: 'Account type is invalid' });
  }
  if (patch.currency !== undefined && !isValidCurrency(patch.currency)) {
    errors.push({ field: 'currency', message: 'Currency is invalid' });
  }
  if (patch.status !== undefined && !isValidAccountStatus(patch.status)) {
    errors.push({ field: 'status', message: 'Status is invalid' });
  }
  if (patch.balance !== undefined) {
    if (!isValidBalance(patch.balance)) {
      errors.push({ field: 'balance', message: balanceMessage });
    } else {
      patch.balance = Number(patch.balance);
    }
  }

  return { errors, patch };
}

module.exports = { validateCreate, validateReplace, validatePatch };
