/**
 * Validation primitives shared across model-specific validators.
 *
 * Kept as small pure functions so they can be composed freely and unit-tested
 * without spinning up Express. None of these talk to the store or know
 * anything about HTTP - that's deliberate.
 */
const { MAX_BALANCE } = require('../config');

// Names allow letters from any script (\p{L}), spaces, hyphens, apostrophes.
const NAME_PATTERN = /^\p{L}[\p{L} \-']*$/u;
// At most 2 decimal places, no scientific notation, no commas.
const BALANCE_PATTERN = /^\d+(\.\d{1,2})?$/;

const isValidEmail = (email) =>
  typeof email === 'string' &&
  email.length <= 120 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidName = (name) =>
  typeof name === 'string' &&
  name.trim().length >= 2 &&
  name.length <= 60 &&
  NAME_PATTERN.test(name.trim());

const isValidBalance = (value) => {
  if (value === '' || value === null || value === undefined) return false;
  const str = value.toString();
  if (!BALANCE_PATTERN.test(str)) return false;
  const num = Number(str);
  return Number.isFinite(num) && num >= 0 && num <= MAX_BALANCE;
};

const isValidEmployeeRole = (role) => ['ADMIN', 'SUPPORT', 'MANAGER'].includes(role);
const isValidEmployeeStatus = (s) => ['ACTIVE', 'INACTIVE'].includes(s);
const isValidAccountType = (t) => ['CHECKING', 'SAVINGS'].includes(t);
const isValidCurrency = (c) => ['CAD', 'USD'].includes(c);
const isValidAccountStatus = (s) => ['OPEN', 'CLOSED'].includes(s);

module.exports = {
  isValidEmail,
  isValidName,
  isValidBalance,
  isValidEmployeeRole,
  isValidEmployeeStatus,
  isValidAccountType,
  isValidCurrency,
  isValidAccountStatus
};
