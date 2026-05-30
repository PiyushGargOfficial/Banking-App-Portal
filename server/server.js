/**
 * Server entry point.
 *
 * Intentionally tiny: build the Express app from app.js and bind it to a
 * port. All routing / middleware / business logic lives in the layers
 * below. That separation lets us reuse the same `app` instance from tests
 * (e.g. supertest) without ever opening a socket.
 */
const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] Banking Admin Portal mock API listening on http://localhost:${PORT}`);
});
