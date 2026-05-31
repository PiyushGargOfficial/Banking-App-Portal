/**
 * Centralised runtime configuration. Anything that can vary per environment
 * (port, header names, limits) lives here so the rest of the codebase reads
 * config from one place instead of sprinkling magic numbers around.
 */
/**
 * Allowed CORS origin(s), driven by the CORS_ORIGIN env var.
 *
 *   - unset            -> the Angular dev server (http://localhost:4200)
 *   - comma-separated  -> an allow-list, e.g. "https://portal.bank.com,https://admin.bank.com"
 *   - the literal "*"  -> every origin (explicit opt-in only; never the default)
 *
 * Defaulting to a single known origin means we never silently ship the
 * "allow everything" behaviour that `cors()` falls back to when no origin
 * is configured.
 */
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
const CORS_ORIGIN =
  rawCorsOrigin.trim() === '*'
    ? '*'
    : rawCorsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

module.exports = {
  PORT: process.env.PORT || 3000,
  CORRELATION_HEADER: 'x-correlation-id',
  /** Allowed CORS origin(s) - a string ("*") or an explicit allow-list array. */
  CORS_ORIGIN,
  /** Upper bound for any single account balance. */
  MAX_BALANCE: 9_999_999_999.99
};
