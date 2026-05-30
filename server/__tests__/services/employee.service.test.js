/**
 * Unit tests for EmployeeService.
 *
 * Primary focus: the `remove()` cascade behaviour. This was the highest-risk
 * untested business rule because:
 *   - it spans two repositories (employees + accounts) in one call
 *   - it must NOT cascade-close accounts that are already CLOSED
 *   - it must emit one DELETE audit entry plus one CASCADE_CLOSE entry per
 *     OPEN account at the time of removal
 *   - the audit trail must survive the employee row being gone
 *
 * Secondary focus: list filtering (search + role + status + hasAccounts)
 * and pagination, since the list query is the only meaningfully complex
 * read path in the service.
 */
const { resetStore } = require('../helpers/reset-store');
const store = require('../../data/store');
const EmployeeService = require('../../services/employee.service');
const AuditService = require('../../services/audit.service');

// --- Fixture helpers --------------------------------------------------------

const now = () => new Date().toISOString();

const makeEmployee = (overrides = {}) => ({
  employeeId: 'emp-1',
  firstName: 'Aarav',
  lastName: 'Sharma',
  email: 'aarav.sharma@bankadmin.io',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: now(),
  updatedAt: now(),
  ...overrides
});

const makeAccount = (overrides = {}) => ({
  accountId: 'acc-1',
  employeeId: 'emp-1',
  accountNumber: '4023600000000001',
  accountType: 'CHECKING',
  currency: 'CAD',
  balance: 100,
  status: 'OPEN',
  createdAt: now(),
  updatedAt: now(),
  ...overrides
});

const ctx = { correlationId: 'cid-test-001', actor: 'tester' };

beforeEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------

describe('EmployeeService.remove - cascade behaviour', () => {
  it('returns false when the employee does not exist', () => {
    const result = EmployeeService.remove('does-not-exist', ctx);

    expect(result).toBe(false);
    expect(store.auditLog).toHaveLength(0);
  });

  it('removes the employee row and returns true on success', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-x' }));

    const result = EmployeeService.remove('emp-x', ctx);

    expect(result).toBe(true);
    expect(store.employees.find((e) => e.employeeId === 'emp-x')).toBeUndefined();
  });

  it('flips every OPEN account owned by the employee to CLOSED', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-a' }));
    store.accounts.push(makeAccount({ accountId: 'acc-a', employeeId: 'emp-a', status: 'OPEN' }));
    store.accounts.push(makeAccount({ accountId: 'acc-b', employeeId: 'emp-a', status: 'OPEN', accountNumber: '4023600000000002' }));

    EmployeeService.remove('emp-a', ctx);

    expect(store.accounts.find((a) => a.accountId === 'acc-a').status).toBe('CLOSED');
    expect(store.accounts.find((a) => a.accountId === 'acc-b').status).toBe('CLOSED');
  });

  it('does NOT emit a CASCADE_CLOSE audit entry for accounts already CLOSED', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-mix' }));
    store.accounts.push(makeAccount({ accountId: 'open',   employeeId: 'emp-mix', status: 'OPEN'   }));
    store.accounts.push(makeAccount({ accountId: 'closed', employeeId: 'emp-mix', status: 'CLOSED', accountNumber: '4023600000000003' }));

    EmployeeService.remove('emp-mix', ctx);

    const cascades = store.auditLog.filter((e) => e.action === 'CASCADE_CLOSE');
    expect(cascades).toHaveLength(1);
    expect(cascades[0].resourceId).toBe('open');
  });

  it('emits exactly one DELETE entry for the employee themselves', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-del' }));

    EmployeeService.remove('emp-del', ctx);

    const deletes = store.auditLog.filter((e) => e.action === 'DELETE');
    expect(deletes).toHaveLength(1);
    expect(deletes[0]).toMatchObject({
      employeeId: 'emp-del',
      resource: 'Employee',
      resourceId: 'emp-del'
    });
    expect(deletes[0].snapshot.email).toBe('aarav.sharma@bankadmin.io');
  });

  it('audit entries persist after the employee row is gone (the whole point)', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-history' }));
    store.accounts.push(makeAccount({ employeeId: 'emp-history', status: 'OPEN' }));

    EmployeeService.remove('emp-history', ctx);

    // Row is gone...
    expect(store.employees.find((e) => e.employeeId === 'emp-history')).toBeUndefined();
    // ...but the audit trail still resolves.
    const trail = AuditService.listForEmployee('emp-history');
    expect(trail.total).toBe(2); // 1 DELETE + 1 CASCADE_CLOSE
  });

  it('forwards the correlationId / actor to every emitted audit entry', () => {
    store.employees.push(makeEmployee({ employeeId: 'emp-cid' }));
    store.accounts.push(makeAccount({ employeeId: 'emp-cid', status: 'OPEN' }));

    EmployeeService.remove('emp-cid', { correlationId: 'cid-XYZ', actor: 'reviewer' });

    for (const entry of store.auditLog) {
      expect(entry.correlationId).toBe('cid-XYZ');
      expect(entry.actor).toBe('reviewer');
    }
  });

  it('updates the cascaded accounts updatedAt timestamps', () => {
    const oldTimestamp = '2020-01-01T00:00:00.000Z';
    store.employees.push(makeEmployee({ employeeId: 'emp-ts' }));
    store.accounts.push(makeAccount({
      accountId: 'acc-ts', employeeId: 'emp-ts', status: 'OPEN', updatedAt: oldTimestamp
    }));

    EmployeeService.remove('emp-ts', ctx);

    const updated = store.accounts.find((a) => a.accountId === 'acc-ts');
    expect(updated.updatedAt).not.toBe(oldTimestamp);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
  });
});

// ---------------------------------------------------------------------------

describe('EmployeeService.create - domain defaults', () => {
  it('defaults status to ACTIVE when omitted', () => {
    const created = EmployeeService.create({
      firstName: 'New', lastName: 'Hire', email: 'new@x.io', role: 'SUPPORT'
    }, ctx);

    expect(created.status).toBe('ACTIVE');
  });

  it('trims whitespace off names', () => {
    const created = EmployeeService.create({
      firstName: '  Jane  ', lastName: '  Doe  ', email: 'jane@x.io', role: 'MANAGER'
    }, ctx);

    expect(created.firstName).toBe('Jane');
    expect(created.lastName).toBe('Doe');
  });

  it('emits a CREATE audit entry attributed to the new employee', () => {
    const created = EmployeeService.create({
      firstName: 'A', lastName: 'B', email: 'a@b.io', role: 'ADMIN'
    }, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0]).toMatchObject({
      action: 'CREATE',
      employeeId: created.employeeId,
      resource: 'Employee'
    });
  });
});

// ---------------------------------------------------------------------------

describe('EmployeeService.list - filters + sort + pagination', () => {
  beforeEach(() => {
    store.employees.push(
      makeEmployee({ employeeId: '1', firstName: 'Aarav',  lastName: 'Sharma',  email: 'a@x.io', role: 'ADMIN',   status: 'ACTIVE' }),
      makeEmployee({ employeeId: '2', firstName: 'Sara',   lastName: 'Khan',    email: 's@x.io', role: 'MANAGER', status: 'ACTIVE' }),
      makeEmployee({ employeeId: '3', firstName: 'Liam',   lastName: 'Tremblay',email: 'l@x.io', role: 'SUPPORT', status: 'INACTIVE' }),
      makeEmployee({ employeeId: '4', firstName: 'Mateo',  lastName: 'Brown',   email: 'm@x.io', role: 'SUPPORT', status: 'ACTIVE' })
    );
    // 1 + 2 own at least one account; 3 + 4 own none.
    store.accounts.push(makeAccount({ accountId: 'acc-1', employeeId: '1' }));
    store.accounts.push(makeAccount({ accountId: 'acc-2', employeeId: '2', accountNumber: '4023600000000002' }));
  });

  it('returns everything when called with no filters', () => {
    const { items, total } = EmployeeService.list();
    expect(items).toHaveLength(4);
    expect(total).toBe(4);
  });

  it('filters by role', () => {
    const { items } = EmployeeService.list({ role: 'SUPPORT' });
    expect(items.map((e) => e.employeeId).sort()).toEqual(['3', '4']);
  });

  it('filters by status', () => {
    const { items } = EmployeeService.list({ status: 'INACTIVE' });
    expect(items.map((e) => e.employeeId)).toEqual(['3']);
  });

  it('filters by case-insensitive search across name + email', () => {
    expect(EmployeeService.list({ search: 'SARA' }).items.map((e) => e.employeeId)).toEqual(['2']);
    expect(EmployeeService.list({ search: 'tremblay' }).items.map((e) => e.employeeId)).toEqual(['3']);
    expect(EmployeeService.list({ search: 'm@x' }).items.map((e) => e.employeeId)).toEqual(['4']);
  });

  it('composes multiple filters with AND semantics', () => {
    const { items } = EmployeeService.list({ role: 'SUPPORT', status: 'ACTIVE' });
    expect(items.map((e) => e.employeeId)).toEqual(['4']);
  });

  it('respects the hasAccounts=with filter (cross-aggregate)', () => {
    const { items } = EmployeeService.list({ hasAccounts: 'with' });
    expect(items.map((e) => e.employeeId).sort()).toEqual(['1', '2']);
  });

  it('respects the hasAccounts=without filter', () => {
    const { items } = EmployeeService.list({ hasAccounts: 'without' });
    expect(items.map((e) => e.employeeId).sort()).toEqual(['3', '4']);
  });

  it('sorts ascending by default on the chosen column', () => {
    const { items } = EmployeeService.list({ sortBy: 'firstName' });
    expect(items.map((e) => e.firstName)).toEqual(['Aarav', 'Liam', 'Mateo', 'Sara']);
  });

  it('sorts descending when sortDir=desc', () => {
    const { items } = EmployeeService.list({ sortBy: 'firstName', sortDir: 'desc' });
    expect(items.map((e) => e.firstName)).toEqual(['Sara', 'Mateo', 'Liam', 'Aarav']);
  });

  it('paginates correctly when size < total', () => {
    const page1 = EmployeeService.list({ sortBy: 'firstName', size: 2, page: 1 });
    const page2 = EmployeeService.list({ sortBy: 'firstName', size: 2, page: 2 });

    expect(page1.items.map((e) => e.firstName)).toEqual(['Aarav', 'Liam']);
    expect(page2.items.map((e) => e.firstName)).toEqual(['Mateo', 'Sara']);
    expect(page1.total).toBe(4);
    expect(page1.page).toBe(1);
    expect(page1.size).toBe(2);
  });
});
