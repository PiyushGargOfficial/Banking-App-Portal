const { v4: uuid } = require('uuid');
const { CORRELATION_HEADER } = require('../config');

/**
 * Correlation-id middleware.
 *
 * If the incoming request already carries an X-Correlation-Id (the Angular
 * client always attaches one via its HTTP interceptor) we echo it back so
 * client and server log lines can be tied together. Otherwise we mint a
 * fresh UUID.
 *
 * The id is also attached to `req` so downstream middleware (logger, error
 * handler) can include it in their output.
 */
module.exports = function correlationId(req, res, next) {
  const incoming = req.header(CORRELATION_HEADER) || uuid();
  res.setHeader(CORRELATION_HEADER, incoming);
  req.correlationId = incoming;
  next();
};
