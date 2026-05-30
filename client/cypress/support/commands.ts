// Custom Cypress commands shared across specs.
//
// `dataCy` is a tiny helper so specs read in terms of data-cy attributes
// rather than brittle CSS selectors.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      dataCy(name: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add('dataCy', (name: string) => cy.get(`[data-cy="${name}"]`));

export {};
