/// <reference types="cypress" />

// Make this spec a module so its top-level consts get file scope (avoids
// TS2451 redeclare collisions with identically-named consts in sibling specs).
export {};

/**
 * E2E: end-to-end happy path for the employee CRUD flow.
 *
 * Assumptions:
 *   - The Express mock server is running on :3000
 *   - The Angular dev server is running on :4200 (proxying /api -> :3000)
 *
 * Run via:    npm --prefix client run e2e        (after `npm start` in the root)
 */
describe('Employee admin flow', () => {
  beforeEach(() => {
    cy.visit('/employees');
  });

  it('shows the seeded employees in the list', () => {
    cy.dataCy('employee-table').should('be.visible');
    cy.dataCy('employee-row').its('length').should('be.gte', 1);
  });

  it('filters employees by search term', () => {
    cy.dataCy('filter-search').clear().type('sara');
    cy.dataCy('employee-row').should('have.length', 1);
    cy.dataCy('employee-row').first().should('contain', 'Sara');
  });

  it('creates a new employee, then deletes it', () => {
    // Use a unique email so re-runs don't conflict with previously created data.
    const uniqueEmail = `cy.user.${Date.now()}@bankadmin.io`;

    cy.dataCy('new-employee').click();
    cy.url().should('include', '/employees/new');

    cy.dataCy('firstName').type('Cypress');
    cy.dataCy('lastName').type('User');
    cy.dataCy('email').type(uniqueEmail).blur();
    // Wait for the async unique-email validator to finish before submitting.
    cy.dataCy('email').should('not.have.class', 'ng-pending');
    cy.dataCy('role').select('SUPPORT');
    cy.dataCy('status').select('ACTIVE');

    cy.dataCy('submit').click();

    // Effect navigates to the new detail page on success.
    cy.url().should('match', /\/employees\/[0-9a-f-]+$/);
    cy.dataCy('employee-summary').should('contain', 'SUPPORT');

    // Delete from detail page.
    cy.dataCy('delete-employee').click();
    cy.dataCy('confirm-ok').click();

    // Back at the list, the new employee should no longer be present.
    cy.url().should('match', /\/employees\b/);
    cy.dataCy('employee-table').should('not.contain', uniqueEmail);
  });

  it('validates required fields on the form', () => {
    cy.dataCy('new-employee').click();
    cy.dataCy('submit').click();

    cy.contains('First name is required').should('be.visible');
    cy.contains('Last name is required').should('be.visible');
    cy.contains('Email is required').should('be.visible');
  });
});
