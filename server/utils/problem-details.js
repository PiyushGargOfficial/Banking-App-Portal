/**
 * RFC 7807 "Problem Details" response builder.
 *
 * Keeps the error-response shape consistent across the app so the Angular
 * error interceptor can rely on the same fields (title, status, detail,
 * optional errors[]) for every failure.
 */
function problem(status, title, detail, extras = {}) {
  return {
    type: `about:blank#${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    status,
    detail,
    ...extras
  };
}

module.exports = { problem };
