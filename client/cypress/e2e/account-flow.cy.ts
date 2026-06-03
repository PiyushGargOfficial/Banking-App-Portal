/// <reference types="cypress" />

// Make this spec a module so its top-level consts get file scope (avoids
// TS2451 redeclare collisions with identically-named consts in sibling specs).
export {};

/**
 * E2E: account CRUD on the employee detail page.
 *
 * The mock backend persists across test runs (it only resets when the
 * Express process restarts), so each test that creates an account uses a
 * unique account number derived from `Date.now()` to avoid the uniqueness
 * constraint clashing with previous runs.
 *
 * Test subject: the seeded ADMIN employee Aarav Sharma whose id is a fixed
 * UUID so the URL stays stable across test runs.
 */
const AARAV_ID = '11111111-1111-1111-1111-111111111111';

const uniqueAccountNumber = () => {
  // 16-digit numeric string (matches the 8-19 digit server validator).
  return `4099${Date.now().toString().slice(-12)}`;
};

/**
 * Yields the account-row whose masked number ends in `last4`.
 *
 * A `cy.contains('code', last4).closest(...)` chain is fragile here: after a
 * mutation (add/close/reopen) the table re-renders asynchronously, so the
 * element `contains` resolves can detach from the DOM before the next link in
 * the chain runs ("element has detached from DOM"). `.filter()` re-runs the
 * whole `account-row` query on every retry, and the `.should('have.length', 1)`
 * keeps retrying until the re-render settles - so we always scope into a live
 * element.
 */
const accountRow = (last4: string) =>
  cy
    .dataCy('account-row')
    .filter((_i, el) => el.querySelector('code')?.textContent?.includes(last4) ?? false)
    .should('have.length', 1);

describe('Account management flow', () => {
  beforeEach(() => {
    cy.visit(`/employees/${AARAV_ID}`);
    cy.dataCy('employee-summary').should('be.visible');
    cy.dataCy('account-list').should('be.visible');
  });

  it('shows the existing accounts and their masked numbers', () => {
    cy.dataCy('account-table').should('exist');
    cy.dataCy('account-row').its('length').should('be.gte', 1);
    // The masking pipe replaces all but the last 4 digits with asterisks.
    cy.dataCy('account-row').first().should('contain', '*');
  });

  it('adds a new account and surfaces it in the table', () => {
    const acctNumber = uniqueAccountNumber();

    cy.dataCy('add-account').click();
    cy.dataCy('account-form').should('be.visible');

    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-type').select('SAVINGS');
    cy.dataCy('acc-currency').select('USD');
    cy.dataCy('acc-balance').clear().type('1250.50');

    cy.dataCy('acc-submit').click();

    // Toast confirms success.
    cy.dataCy('toast').should('contain.text', 'Account added');
    // Row exists with the last 4 digits visible.
    const last4 = acctNumber.slice(-4);
    cy.dataCy('account-table').contains('code', last4).should('be.visible');
  });

  it('refuses to submit when the account number is too short', () => {
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type('1234567'); // 7 digits, below the 8-19 floor
    cy.dataCy('acc-balance').clear().type('100');
    cy.dataCy('acc-submit').click();

    cy.contains(/Account number must be 8-19 digits/).should('be.visible');
    // Still on the form, not navigated away.
    cy.dataCy('account-form').should('be.visible');
  });

  it('refuses to submit when balance is negative', () => {
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(uniqueAccountNumber());
    cy.dataCy('acc-balance').clear().type('-50');
    cy.dataCy('acc-submit').click();

    cy.contains(/Balance cannot be negative/).should('be.visible');
  });

  it('refuses to submit when balance has more than 2 decimal places', () => {
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(uniqueAccountNumber());
    cy.dataCy('acc-balance').clear().type('100.123');
    cy.dataCy('acc-submit').click();

    cy.contains(/at most 2 decimal places/).should('be.visible');
  });

  it('closes an account via the confirm dialog and surfaces a Reopen button', () => {
    // Add a fresh account so we have a known-OPEN row to operate on.
    const acctNumber = uniqueAccountNumber();
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-balance').clear().type('10');
    cy.dataCy('acc-submit').click();
    cy.dataCy('toast').should('contain.text', 'Account added');

    const last4 = acctNumber.slice(-4);

    // Locate the row that contains the new account, then click its Close.
    accountRow(last4).within(() => {
      cy.dataCy('close-account').click();
    });

    // Confirm dialog appears - click OK.
    cy.dataCy('confirm-ok').click();
    cy.dataCy('toast').should('contain.text', 'Account closed');

    // The row now has a CLOSED badge and a Reopen button instead of Edit/Close.
    accountRow(last4).within(() => {
      cy.contains('CLOSED').should('be.visible');
      cy.dataCy('reopen-account').should('exist');
    });
  });

  it('reopens a closed account back to OPEN', () => {
    const acctNumber = uniqueAccountNumber();
    cy.dataCy('add-account').click();
    cy.dataCy('acc-number').type(acctNumber);
    cy.dataCy('acc-balance').clear().type('10');
    cy.dataCy('acc-submit').click();
    cy.dataCy('toast').should('contain.text', 'Account added');

    const last4 = acctNumber.slice(-4);

    // Close it.
    accountRow(last4).within(() => cy.dataCy('close-account').click());
    cy.dataCy('confirm-ok').click();

    // Reopen it.
    accountRow(last4).within(() => cy.dataCy('reopen-account').click());

    cy.dataCy('toast').should('contain.text', 'Account updated');
    accountRow(last4).within(() => {
      cy.contains('OPEN').should('be.visible');
      cy.dataCy('edit-account').should('exist');
      cy.dataCy('close-account').should('exist');
    });
  });
});
