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
  MAX_BALANCE: 9_999_999_999.99,
  /**
   * Hard ceiling for `?size=` on any paginated list endpoint.
   *
   * Defends against cheap denial-of-service via huge responses: without a
   * clamp, an attacker (or a careless integration) can ask for `?size=999999`
   * and force the server to slice and serialise the whole collection.
   *
   * 100 is comfortably above the UI's largest page-size select (25) so
   * legitimate consumers never notice, and far below the point at which
   * JSON serialisation starts costing real CPU + memory.
   */
  MAX_PAGE_SIZE: 100
};
