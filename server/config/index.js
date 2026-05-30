/**
 * Centralised runtime configuration. Anything that can vary per environment
 * (port, header names, limits) lives here so the rest of the codebase reads
 * config from one place instead of sprinkling magic numbers around.
 */
module.exports = {
  PORT: process.env.PORT || 3000,
  CORRELATION_HEADER: 'x-correlation-id',
  /** Upper bound for any single account balance. */
  MAX_BALANCE: 9_999_999_999.99
};
