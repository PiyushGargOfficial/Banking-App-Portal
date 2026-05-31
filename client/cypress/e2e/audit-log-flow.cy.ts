/// <reference types="cypress" />

/**
 * E2E: append-only audit log behaviour.
 *
 * Each test performs an action on the employee detail page and then
 * verifies that a matching entry shows up at the TOP of the audit log
 * (newest-first ordering). We never assert against the total count of
 * entries because the mock backend persists across test runs and that
 * count would drift with every iteration.
 *
 * Subject: Aarav Sharma (fixed seeded UUID) so the URL stays stable.
 */
const AARAV_ID = '11111111-1111-1111-1111-111111111111';

const uniqueAccountNumber = () => `4099${Date.now().toString().slice(-12)}`;

describe('Audit log flow', () => {
  beforeEach(() => {
    cy.visit(`/employees/${AARAV_ID}`);
    cy.dataCy('audit-log').should('be.visible');
  });

  it('shows the audit log card with a Refresh button', () => {
    cy.dataCy('audit-log').within(() => {
      cy.contains('Audit log').should('be.visible');
      cy.dataCy('audit-refresh').should('be.visible');
    });
  });

  it('records a UPDATE entry with a status diff when the status is toggled', () => {
    // Toggle once: ACTIVE -> INACTIVE (or vice versa depending on current).
    cy.dataCy('toggle-status').click();
    cy.dataCy('toast').should('contain.text', 'Employee marked');

    cy.dataCy('audit-refresh').click();

    cy.dataCy('audit-entry')
      .first()
      .within(() => {
        cy.dataCy('audit-action').should('contain.text', 'UPDATE');
        cy.contains('Employee').should('be.visible');
        cy.contains('status').should('be.visible');
      });

    // Restore initial state so the next test starts from a known position.
    cy.dataCy('toggle-status').click();
  });

  it('records a Account CREATE entry when an account is added', () => {
    const acctNumber = uniqueAccountNumber();

    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-balance').clear().type('500');
    cy.dataCy('acc-submit').click();
    cy.dataCy('toast').should('contain.text', 'Account added');

    cy.dataCy('audit-refresh').click();

    const last4 = acctNumber.slice(-4);
    cy.dataCy('audit-entry')
      .first()
      .within(() => {
        cy.dataCy('audit-action').should('contain.text', 'CREATE');
        cy.contains('Account').should('be.visible');
        cy.contains(last4).should('be.visible');
      });
  });

  it('records a CLOSE entry when an account is closed (not a status UPDATE)', () => {
    const acctNumber = uniqueAccountNumber();

    // Set up: add a fresh account.
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-balance').clear().type('20');
    cy.dataCy('acc-submit').click();
    cy.dataCy('toast').should('contain.text', 'Account added');

    const last4 = acctNumber.slice(-4);

    // Close it.
    cy.dataCy('account-row')
      .contains('code', last4)
      .closest('[data-cy="account-row"]')
      .within(() => cy.dataCy('close-account').click());
    cy.dataCy('confirm-ok').click();
    cy.dataCy('toast').should('contain.text', 'Account closed');

    cy.dataCy('audit-refresh').click();

    cy.dataCy('audit-entry')
      .first()
      .within(() => {
        // Important: the close path produces a CLOSE entry (the dedicated
        // narrative), NOT a generic UPDATE with a status diff. This is the
        // whole point of having named-action audit entries.
        cy.dataCy('audit-action').should('contain.text', 'CLOSE');
        cy.contains(last4).should('be.visible');
      });
  });

  it('records a REOPEN entry when a closed account is reopened', () => {
    const acctNumber = uniqueAccountNumber();
    const last4 = acctNumber.slice(-4);

    // Add + close.
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-balance').clear().type('20');
    cy.dataCy('acc-submit').click();
    cy.dataCy('toast').should('contain.text', 'Account added');

    cy.dataCy('account-row')
      .contains('code', last4)
      .closest('[data-cy="account-row"]')
      .within(() => cy.dataCy('close-account').click());
    cy.dataCy('confirm-ok').click();

    // Reopen.
    cy.dataCy('account-row')
      .contains('code', last4)
      .closest('[data-cy="account-row"]')
      .within(() => cy.dataCy('reopen-account').click());
    cy.dataCy('toast').should('contain.text', 'Account updated');

    cy.dataCy('audit-refresh').click();

    cy.dataCy('audit-entry')
      .first()
      .within(() => {
        cy.dataCy('audit-action').should('contain.text', 'REOPEN');
        cy.contains(last4).should('be.visible');
      });
  });

  it('shows actor + correlation id in the entry footer', () => {
    // Force a write so we have a guaranteed-fresh entry to inspect.
    cy.dataCy('toggle-status').click();
    cy.dataCy('toast').should('contain.text', 'Employee marked');
    cy.dataCy('audit-refresh').click();

    cy.dataCy('audit-entry')
      .first()
      .within(() => {
        cy.contains('admin').should('be.visible'); // actor
        cy.contains('cid:').should('be.visible'); // cid label
      });

    // Restore initial state.
    cy.dataCy('toggle-status').click();
  });
});
