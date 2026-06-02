/// <reference types="cypress" />

// Make this spec a module so its top-level consts get file scope (avoids
// TS2451 redeclare collisions with identically-named consts in sibling specs).
export {};

/**
 * API-level HTTP-boundary tests (cy.request, no browser/DOM).
 *
 * These exercise the controller layer end-to-end through real HTTP and assert
 * the contract a client depends on:
 *   - the right status codes: 201 / 400 / 404 / 409 / 204 / 200
 *   - the RFC 7807 problem-details shape on every error
 *   - the X-Correlation-Id round-trip
 *
 * The mock backend keeps in-memory state for the life of the process, so every
 * test creates its own resources with unique identifiers (no shared fixtures
 * to collide with). baseUrl is the API itself (see cypress.config.api.ts), so
 * paths below are written relative to http://localhost:3000.
 */

const api = '/api';

// Unique values so reruns against a long-lived server never clash.
const uniqueEmail = () => `e2e.${Date.now()}.${Cypress._.random(0, 1e6)}@test.io`;
const uniqueAccountNumber = () => `4099${Date.now().toString().slice(-12)}`;

const validEmployee = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Api',
  lastName: 'Tester',
  email: uniqueEmail(),
  role: 'SUPPORT',
  ...overrides
});

/** Assert the shared RFC 7807 problem-details envelope. */
function expectProblemDetails(body: any, status: number, title: string) {
  expect(body, 'problem-details body').to.include({ status, title });
  expect(body.type).to.eq(`about:blank#${title.toLowerCase().replace(/\s+/g, '-')}`);
  expect(body.detail, 'detail').to.be.a('string').and.not.be.empty;
}

/** Create an employee via the API and return the parsed body. */
function createEmployee(overrides: Record<string, unknown> = {}) {
  return cy
    .request('POST', `${api}/employees`, validEmployee(overrides))
    .then((res) => res.body as { employeeId: string; email: string });
}

describe('Employees HTTP boundary', () => {
  it('POST /employees with a valid body returns 201 and the created resource', () => {
    const body = validEmployee();
    cy.request('POST', `${api}/employees`, body).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.employeeId).to.be.a('string').and.not.be.empty;
      expect(res.body.email).to.eq(body.email);
      expect(res.body.status).to.eq('ACTIVE'); // server default
    });
  });

  it('GET /employees/:id returns 200 for an existing employee', () => {
    createEmployee().then((emp) => {
      cy.request('GET', `${api}/employees/${emp.employeeId}`).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body.employeeId).to.eq(emp.employeeId);
      });
    });
  });

  it('POST /employees with an invalid body returns 400 + problem-details with field errors', () => {
    cy.request({
      method: 'POST',
      url: `${api}/employees`,
      failOnStatusCode: false,
      body: { firstName: '', lastName: '', email: 'not-an-email', role: 'CEO' }
    }).then((res) => {
      expect(res.status).to.eq(400);
      expectProblemDetails(res.body, 400, 'Validation Failed');
      expect(res.body.errors).to.be.an('array').and.have.length.greaterThan(0);
      expect(res.body.errors[0]).to.have.all.keys('field', 'message');
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).to.include.members(['firstName', 'lastName', 'email', 'role']);
    });
  });

  it('POST /employees with a duplicate email returns 409', () => {
    createEmployee().then((emp) => {
      cy.request({
        method: 'POST',
        url: `${api}/employees`,
        failOnStatusCode: false,
        body: validEmployee({ email: emp.email })
      }).then((res) => {
        expect(res.status).to.eq(409);
        expectProblemDetails(res.body, 409, 'Conflict');
      });
    });
  });

  it('GET /employees/:id returns 404 + problem-details for an unknown id', () => {
    cy.request({
      method: 'GET',
      url: `${api}/employees/does-not-exist`,
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status).to.eq(404);
      expectProblemDetails(res.body, 404, 'Not Found');
    });
  });

  it('PATCH /employees/:id returns 404 for an unknown id', () => {
    cy.request({
      method: 'PATCH',
      url: `${api}/employees/does-not-exist`,
      failOnStatusCode: false,
      body: { status: 'INACTIVE' }
    }).then((res) => {
      expect(res.status).to.eq(404);
      expectProblemDetails(res.body, 404, 'Not Found');
    });
  });

  it('DELETE /employees/:id returns 204 with no body', () => {
    createEmployee().then((emp) => {
      cy.request('DELETE', `${api}/employees/${emp.employeeId}`).then((res) => {
        expect(res.status).to.eq(204);
        expect(res.body).to.be.empty;
      });
    });
  });

  it('echoes an X-Correlation-Id header on the response', () => {
    cy.request('GET', `${api}/employees?size=1`).then((res) => {
      expect(res.headers).to.have.property('x-correlation-id');
      expect(res.headers['x-correlation-id']).to.be.a('string').and.not.be.empty;
    });
  });
});

describe('Accounts HTTP boundary', () => {
  it('POST /employees/:id/accounts with a valid body returns 201 (OPEN, balance defaulted)', () => {
    createEmployee().then((emp) => {
      cy.request('POST', `${api}/employees/${emp.employeeId}/accounts`, {
        accountNumber: uniqueAccountNumber(),
        accountType: 'CHECKING',
        currency: 'CAD'
      }).then((res) => {
        expect(res.status).to.eq(201);
        expect(res.body.accountId).to.be.a('string').and.not.be.empty;
        expect(res.body.status).to.eq('OPEN'); // domain default
        expect(res.body.balance).to.eq(0); // domain default
      });
    });
  });

  it('POST account with a malformed account number returns 400 + field error', () => {
    createEmployee().then((emp) => {
      cy.request({
        method: 'POST',
        url: `${api}/employees/${emp.employeeId}/accounts`,
        failOnStatusCode: false,
        body: { accountNumber: '123', accountType: 'CHECKING', currency: 'CAD' }
      }).then((res) => {
        expect(res.status).to.eq(400);
        expectProblemDetails(res.body, 400, 'Validation Failed');
        const fields = res.body.errors.map((e: { field: string }) => e.field);
        expect(fields).to.include('accountNumber');
      });
    });
  });

  it('POST account with a duplicate account number returns 409', () => {
    createEmployee().then((emp) => {
      const accountNumber = uniqueAccountNumber();
      const payload = { accountNumber, accountType: 'SAVINGS', currency: 'USD' };
      cy.request('POST', `${api}/employees/${emp.employeeId}/accounts`, payload);
      cy.request({
        method: 'POST',
        url: `${api}/employees/${emp.employeeId}/accounts`,
        failOnStatusCode: false,
        body: payload
      }).then((res) => {
        expect(res.status).to.eq(409);
        expectProblemDetails(res.body, 409, 'Conflict');
      });
    });
  });

  it('POST account under a non-existent employee returns 404', () => {
    cy.request({
      method: 'POST',
      url: `${api}/employees/no-such-employee/accounts`,
      failOnStatusCode: false,
      body: { accountNumber: uniqueAccountNumber(), accountType: 'CHECKING', currency: 'CAD' }
    }).then((res) => {
      expect(res.status).to.eq(404);
      expectProblemDetails(res.body, 404, 'Not Found');
    });
  });

  it('GET /accounts/:id returns 404 for an unknown account', () => {
    cy.request({
      method: 'GET',
      url: `${api}/accounts/does-not-exist`,
      failOnStatusCode: false
    }).then((res) => {
      expect(res.status).to.eq(404);
      expectProblemDetails(res.body, 404, 'Not Found');
    });
  });

  it('DELETE /accounts/:id soft-closes (200 + status CLOSED, not 204)', () => {
    createEmployee().then((emp) => {
      cy.request('POST', `${api}/employees/${emp.employeeId}/accounts`, {
        accountNumber: uniqueAccountNumber(),
        accountType: 'CHECKING',
        currency: 'CAD'
      }).then((created) => {
        cy.request('DELETE', `${api}/accounts/${created.body.accountId}`).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.status).to.eq('CLOSED');
        });
      });
    });
  });

  it('PATCH /accounts/:id reopens a closed account (200 + status OPEN)', () => {
    createEmployee().then((emp) => {
      cy.request('POST', `${api}/employees/${emp.employeeId}/accounts`, {
        accountNumber: uniqueAccountNumber(),
        accountType: 'CHECKING',
        currency: 'CAD'
      }).then((created) => {
        const id = created.body.accountId;
        cy.request('DELETE', `${api}/accounts/${id}`); // close first
        cy.request('PATCH', `${api}/accounts/${id}`, { status: 'OPEN' }).then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.status).to.eq('OPEN');
        });
      });
    });
  });
});
