const morgan = require('morgan');

/**
 * HTTP access logger. Uses morgan with a custom token that pulls the
 * correlation id off `req` (set by the correlation-id middleware), so each
 * log line includes the same cid that came back to the browser.
 */
morgan.token('cid', (req) => req.correlationId);

module.exports = morgan(':method :url :status :response-time ms - cid=:cid');
