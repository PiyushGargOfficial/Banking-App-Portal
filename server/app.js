/**
 * Express application factory.
 *
 * Pulls every layer together in the order the request travels:
 *   1. CORS - restrict to the configured origin(s) and expose the cid header
 *   2. JSON parser - body parsing for POST/PUT/PATCH
 *   3. correlationId - attaches an X-Correlation-Id to req + response
 *   4. logger - access log including the correlation id
 *   5. routes - mount the resource routers under /api
 *   6. notFound - 404 fallback in problem-details shape
 *   7. errorHandler - catch-all for uncaught errors
 *
 * Exporting the app (not a running server) keeps it easy to plug into
 * supertest / unit tests later without having to bind a port.
 */
const express = require('express');
const cors = require('cors');

const { CORRELATION_HEADER, CORS_ORIGIN } = require('./config');
const correlationId = require('./middleware/correlation-id');
const logger = require('./middleware/logger');
const { notFound, errorHandler } = require('./middleware/error-handler');

const employeeRoutes = require('./routes/employee.routes');
const accountRoutes = require('./routes/account.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

app.use(cors({ origin: CORS_ORIGIN, exposedHeaders: [CORRELATION_HEADER] }));
app.use(express.json());
app.use(correlationId);
app.use(logger);

// Account + audit routes come first because they expose nested paths under
// /api/employees/:id/... that would otherwise be matched by the generic
// employee router. Express matches the most specific path each router
// registers, but explicit ordering keeps intent clear.
app.use('/api', accountRoutes);
app.use('/api', auditRoutes);
app.use('/api/employees', employeeRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
