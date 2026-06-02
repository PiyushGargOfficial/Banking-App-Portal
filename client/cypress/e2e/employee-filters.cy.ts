/// <reference types="cypress" />

// Make this spec a module so its top-level consts get file scope (avoids
// TS2451 redeclare collisions with identically-named consts in sibling specs).
export {};

/**
 * E2E: filter composition on the employee list page.
 *
 * The seeded data has a known distribution:
 *   - 33 employees total
 *   - Roles:  5 ADMIN, 10 MANAGER, 18 SUPPORT
 *   - Status: 28 ACTIVE, 5 INACTIVE
 *   - 8 employees own at least one account (the 3 fixed seeds + 5 more)
 *
 * We assert relationships ("filtering by role narrows the result", "with +
 * without partition the universe") instead of exact counts where possible -
 * tests stay green even if the seed file evolves slightly.
 */

describe('Employee filters', () => {
  beforeEach(() => {
    cy.visit('/employees');
    cy.dataCy('employee-table').should('be.visible');
    // Make sure the page-size select doesn't hide rows we're trying to count.
    cy.get('#size').select('25');
  });

  it('search filter narrows the list to matches by name', () => {
    cy.dataCy('filter-search').clear().type('sara');
    // Wait for the debounced re-fetch to settle.
    cy.dataCy('employee-row').its('length').should('be.lessThan', 5);
    cy.dataCy('employee-row').first().should('contain.text', 'Sara');
  });

  it('search filter matches against email too', () => {
    cy.dataCy('filter-search').clear().type('bankadmin.io');
    cy.dataCy('employee-row').its('length').should('be.gte', 1);
  });

  it('role filter shows only matching role', () => {
    cy.dataCy('filter-role').select('ADMIN');
    cy.dataCy('employee-row').each(($row) => {
      cy.wrap($row).find('.badge.role').should('contain.text', 'ADMIN');
    });
  });

  it('status filter shows only matching status', () => {
    cy.dataCy('filter-status').select('INACTIVE');
    cy.dataCy('employee-row').each(($row) => {
      cy.wrap($row).contains('INACTIVE').should('be.visible');
    });
  });

  it('hasAccounts=with shows only employees who own at least one account', () => {
    cy.dataCy('filter-accounts').select('with');
    // Aarav Sharma is a seeded with-accounts employee.
    cy.dataCy('employee-table').should('contain.text', 'Aarav');
    cy.dataCy('employee-row').its('length').should('be.gte', 1);
  });

  it('hasAccounts=without and hasAccounts=with partition the full list', () => {
    cy.dataCy('filter-accounts').select('with');
    cy.dataCy('employee-row').then(($withRows) => {
      const withCount = $withRows.length;

      cy.dataCy('filter-accounts').select('without');
      cy.dataCy('employee-row').then(($withoutRows) => {
        const withoutCount = $withoutRows.length;

        // No overlap, no gaps. With + without should cover the whole list.
        cy.dataCy('filter-accounts').select(''); // back to "all"
        cy.dataCy('employee-row')
          .its('length')
          .should('eq', withCount + withoutCount);
      });
    });
  });

  it('composes role + status with AND semantics', () => {
    cy.dataCy('filter-role').select('SUPPORT');
    cy.dataCy('filter-status').select('INACTIVE');

    cy.dataCy('employee-row').each(($row) => {
      cy.wrap($row).find('.badge.role').should('contain.text', 'SUPPORT');
      cy.wrap($row).contains('INACTIVE').should('be.visible');
    });
  });

  it('reset clears all filters and restores the full list', () => {
    // Set a few filters.
    cy.dataCy('filter-search').clear().type('liam');
    cy.dataCy('filter-role').select('SUPPORT');
    cy.dataCy('filter-status').select('INACTIVE');

    // Record the count of the filtered set.
    cy.dataCy('employee-row').then(($filtered) => {
      const filteredCount = $filtered.length;

      cy.dataCy('filter-reset').click();

      cy.dataCy('filter-search').should('have.value', '');
      cy.dataCy('filter-role').should('have.value', '');
      cy.dataCy('filter-status').should('have.value', '');
      cy.dataCy('filter-accounts').should('have.value', '');
      // After reset the visible row count should be at least as large as
      // before (resetting only ever broadens the result set).
      cy.dataCy('employee-row').its('length').should('be.gte', filteredCount);
    });
  });

  it('returns to page 1 after a filter change (no stale empty page)', () => {
    // Navigate to page 2 first.
    cy.get('#size').select('10');
    cy.contains('button', 'Next').click();
    cy.contains('button', 'Prev').should('not.be.disabled');

    // Apply a filter that obviously narrows the result.
    cy.dataCy('filter-search').clear().type('sara');

    // Visible content must be the (single) Sara row; the page indicator
    // resets so Prev is now disabled.
    cy.dataCy('employee-row').should('contain.text', 'Sara');
    cy.contains('button', 'Prev').should('be.disabled');
  });
});
