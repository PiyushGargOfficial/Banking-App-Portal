import { defineConfig } from 'cypress';

/**
 * Cypress configuration for API-level tests.
 *
 * Unlike the e2e config, these specs talk to the Express mock backend
 * *directly* via cy.request() and never open the Angular app. So:
 *   - baseUrl points at the API (port 3000), not the dev server (4200)
 *   - there's no DOM support file to load (the dataCy command is irrelevant)
 *
 * In CI the server is booted with start-server-and-test before this runs;
 * locally, `npm run e2e:api` from the repo root does the same orchestration.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/api/**/*.cy.ts',
    supportFile: false,
    video: false,
    screenshotOnRunFailure: false
  }
});
