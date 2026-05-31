const { problem } = require('../utils/problem-details');

/**
 * Catch-all 404 - mounted after every route so unmatched paths return a
 * structured problem-details body instead of Express's default HTML page.
 */
function notFound(req, res) {
  res
    .status(404)
    .json(problem(404, 'Not Found', `Route ${req.method} ${req.originalUrl} does not exist`));
}

/**
 * Last-resort error handler. Any uncaught exception or `next(err)` call in
 * the controller layer lands here. We log with the correlation id so the
 * client (which sees the same cid in the response header) can be matched
 * to a specific server-side log entry.
 *
 * Note: Express identifies this as an error handler by its 4-arg signature,
 * so the unused `next` must stay.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error('[server] Unhandled error', { cid: req.correlationId, err });
  res.status(500).json(problem(500, 'Internal Server Error', 'An unexpected error occurred'));
}

module.exports = { notFound, errorHandler };
