import { defineConfig } from 'cypress';

// Cypress configuration. The e2e baseUrl points at the Angular dev server
// (proxied to the Express mock backend via proxy.conf.json).
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: false,
    viewportWidth: 1280,
    viewportHeight: 800
  }
});
