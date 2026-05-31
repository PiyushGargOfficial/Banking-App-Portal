/**
 * Unit tests for AuditService.
 *
 * Focus areas (the highest-risk logic that was previously untested):
 *   - diff computation: no-op writes must NOT produce an UPDATE entry,
 *     multi-field changes must surface every changed field, and only
 *     fields whose values actually differ make it into changes[].
 *   - the named-narrative methods (recordAccountClosed / Reopened /
 *     CascadeClosed) must use the correct action label.
 *   - context normalisation: omitting `actor` / `correlationId` must
 *     fall back to safe defaults.
 *   - listForEmployee ordering + pagination.
 *
 * The audit module's `diff()` helper is intentionally private. We test
 * it through the public recordEmployeeUpdated / recordAccountUpdated
 * methods that use it - that's also the only way it's used in real code.
 */
const { resetStore } = require('../helpers/reset-store');
const store = require('../../data/store');
const AuditService = require('../../services/audit.service');

// --- Test fixtures (kept inline so each test is self-contained) -------------

const baseEmployee = {
  employeeId: 'emp-1',
  firstName: 'Aarav',
  lastName: 'Sharma',
  email: 'aarav.sharma@bankadmin.io',
  role: 'ADMIN',
  status: 'ACTIVE'
};

const baseAccount = {
  accountId: 'acc-1',
  employeeId: 'emp-1',
  accountNumber: '4023600012348877',
  accountType: 'CHECKING',
  currency: 'CAD',
  balance: 100.0,
  status: 'OPEN'
};

const ctx = { correlationId: 'cid-test-001', actor: 'tester' };

// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

describe('AuditService.recordEmployeeCreated', () => {
  it('appends a CREATE entry tagged to the new employee', () => {
    const entry = AuditService.recordEmployeeCreated(baseEmployee, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(entry).toMatchObject({
      employeeId: 'emp-1',
      resource: 'Employee',
      resourceId: 'emp-1',
      action: 'CREATE',
      actor: 'tester',
      correlationId: 'cid-test-001'
    });
  });

  it('captures every tracked field in the snapshot', () => {
    AuditService.recordEmployeeCreated(baseEmployee, ctx);

    expect(store.auditLog[0].snapshot).toEqual({
      firstName: 'Aarav',
      lastName: 'Sharma',
      email: 'aarav.sharma@bankadmin.io',
      role: 'ADMIN',
      status: 'ACTIVE'
    });
  });

  it('stamps a UUID-looking entryId and an ISO timestamp', () => {
    AuditService.recordEmployeeCreated(baseEmployee, ctx);

    const entry = store.auditLog[0];
    expect(entry.entryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('AuditService.recordEmployeeUpdated (diff computation)', () => {
  it('returns null and appends NO entry when nothing changed', () => {
    const result = AuditService.recordEmployeeUpdated(baseEmployee, baseEmployee, ctx);

    expect(result).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });

  it('records exactly the field that changed when one field changed', () => {
    const after = { ...baseEmployee, status: 'INACTIVE' };

    AuditService.recordEmployeeUpdated(baseEmployee, after, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0]).toMatchObject({
      action: 'UPDATE',
      changes: [{ field: 'status', before: 'ACTIVE', after: 'INACTIVE' }]
    });
  });

  it('records every changed field when multiple change in one write', () => {
    const after = {
      ...baseEmployee,
      firstName: 'Aarav', // unchanged
      lastName: 'Sharma-Singh', // changed
      email: 'aarav.singh@bankadmin.io', // changed
      role: 'ADMIN', // unchanged
      status: 'INACTIVE' // changed
    };

    AuditService.recordEmployeeUpdated(baseEmployee, after, ctx);

    const entry = store.auditLog[0];
    expect(entry.changes).toHaveLength(3);
    expect(entry.changes).toEqual(
      expect.arrayContaining([
        { field: 'lastName', before: 'Sharma', after: 'Sharma-Singh' },
        { field: 'email', before: 'aarav.sharma@bankadmin.io', after: 'aarav.singh@bankadmin.io' },
        { field: 'status', before: 'ACTIVE', after: 'INACTIVE' }
      ])
    );
  });

  it('treats undefined-vs-defined as a change (covers added fields)', () => {
    const before = { ...baseEmployee, status: undefined };
    const after = { ...baseEmployee, status: 'ACTIVE' };

    AuditService.recordEmployeeUpdated(before, after, ctx);

    expect(store.auditLog[0].changes).toEqual([
      { field: 'status', before: undefined, after: 'ACTIVE' }
    ]);
  });

  it('does not include untracked fields even if they differ', () => {
    // updatedAt is on the row but NOT in the tracked field set.
    const before = { ...baseEmployee, updatedAt: '2026-01-01T00:00:00Z' };
    const after = { ...baseEmployee, updatedAt: '2026-05-28T00:00:00Z' };

    const result = AuditService.recordEmployeeUpdated(before, after, ctx);

    expect(result).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });
});

describe('AuditService.recordEmployeeDeleted', () => {
  it('appends a DELETE entry that survives the row being gone', () => {
    AuditService.recordEmployeeDeleted(baseEmployee, ctx);

    expect(store.auditLog[0]).toMatchObject({
      employeeId: 'emp-1',
      resource: 'Employee',
      action: 'DELETE',
      snapshot: expect.objectContaining({ email: 'aarav.sharma@bankadmin.io' })
    });
  });
});

describe('AuditService account narratives', () => {
  it('recordAccountCreated stores accountNumber alongside the snapshot', () => {
    AuditService.recordAccountCreated(baseAccount, ctx);

    expect(store.auditLog[0]).toMatchObject({
      employeeId: 'emp-1',
      resource: 'Account',
      resourceId: 'acc-1',
      action: 'CREATE',
      snapshot: expect.objectContaining({
        accountNumber: '4023600012348877',
        accountType: 'CHECKING',
        currency: 'CAD',
        balance: 100.0,
        status: 'OPEN'
      })
    });
  });

  it('recordAccountClosed uses the CLOSE action, not a status diff', () => {
    AuditService.recordAccountClosed({ ...baseAccount, status: 'CLOSED' }, ctx);

    expect(store.auditLog[0]).toMatchObject({
      action: 'CLOSE',
      accountNumber: '4023600012348877'
    });
    // No changes[] - closing has its own narrative.
    expect(store.auditLog[0].changes).toBeUndefined();
  });

  it('recordAccountReopened uses the REOPEN action', () => {
    AuditService.recordAccountReopened(baseAccount, ctx);

    expect(store.auditLog[0]).toMatchObject({
      action: 'REOPEN',
      accountNumber: '4023600012348877'
    });
  });

  it('recordAccountCascadeClosed labels CASCADE_CLOSE and includes a reason', () => {
    AuditService.recordAccountCascadeClosed(baseAccount, ctx);

    expect(store.auditLog[0]).toMatchObject({
      action: 'CASCADE_CLOSE',
      accountNumber: '4023600012348877',
      reason: 'Owner employee deleted'
    });
  });

  it('recordAccountUpdated drops no-op writes the same as the employee path', () => {
    expect(AuditService.recordAccountUpdated(baseAccount, baseAccount, ctx)).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });

  it('recordAccountUpdated captures balance + status changes only', () => {
    const after = { ...baseAccount, balance: 250.5, status: 'OPEN' };

    AuditService.recordAccountUpdated(baseAccount, after, ctx);

    expect(store.auditLog[0].changes).toEqual([{ field: 'balance', before: 100.0, after: 250.5 }]);
  });
});

describe('AuditService context normalisation', () => {
  it('defaults actor to "admin" when not supplied', () => {
    AuditService.recordEmployeeCreated(baseEmployee, {});

    expect(store.auditLog[0].actor).toBe('admin');
  });

  it('defaults correlationId to null when not supplied', () => {
    AuditService.recordEmployeeCreated(baseEmployee, {});

    expect(store.auditLog[0].correlationId).toBeNull();
  });

  it('handles a completely undefined context argument', () => {
    AuditService.recordEmployeeCreated(baseEmployee);

    expect(store.auditLog[0]).toMatchObject({ actor: 'admin', correlationId: null });
  });
});

describe('AuditService.listForEmployee', () => {
  beforeEach(() => {
    // Three entries for emp-1, one for emp-2, written in this order so the
    // newest-first ordering can be verified by the chosen actor labels.
    AuditService.recordEmployeeCreated(baseEmployee, { actor: 'first' });
    AuditService.recordEmployeeUpdated(
      baseEmployee,
      { ...baseEmployee, status: 'INACTIVE' },
      { actor: 'second' }
    );
    AuditService.recordEmployeeCreated(
      { ...baseEmployee, employeeId: 'emp-2' },
      { actor: 'other-employee' }
    );
    AuditService.recordAccountCreated(baseAccount, { actor: 'third' });
  });

  it('returns only entries belonging to the given employee', () => {
    const { items, total } = AuditService.listForEmployee('emp-1');

    expect(items).toHaveLength(3);
    expect(total).toBe(3);
    expect(items.every((e) => e.employeeId === 'emp-1')).toBe(true);
  });

  it('returns entries newest-first', () => {
    const { items } = AuditService.listForEmployee('emp-1');

    // The chronological write order was first -> second -> third; reverse
    // chronological order means we expect third -> second -> first.
    expect(items.map((e) => e.actor)).toEqual(['third', 'second', 'first']);
  });

  it('paginates correctly when more entries exist than the page size', () => {
    const page1 = AuditService.listForEmployee('emp-1', { page: 1, size: 2 });
    const page2 = AuditService.listForEmployee('emp-1', { page: 2, size: 2 });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);
    // Last-page item is the oldest entry.
    expect(page2.items[0].actor).toBe('first');
  });

  it('returns an empty result for an unknown employee', () => {
    const { items, total } = AuditService.listForEmployee('nonexistent');

    expect(items).toEqual([]);
    expect(total).toBe(0);
  });
});

describe('AuditService.listForEmployee - MAX_PAGE_SIZE clamp', () => {
  // Read the clamp from config so the test stays correct if the value
  // is ever tuned. Importing here (not at top of file) keeps the rest of
  // the suite unaware of the limit.
  const { MAX_PAGE_SIZE } = require('../../config');

  beforeEach(() => {
    // Seed (MAX_PAGE_SIZE + 25) entries so we have enough to prove the
    // clamp is doing something meaningful.
    for (let i = 0; i < MAX_PAGE_SIZE + 25; i++) {
      AuditService.recordEmployeeCreated(
        { ...baseEmployee, employeeId: 'emp-clamp' },
        { actor: `tester-${i}` }
      );
    }
  });

  it('returns at most MAX_PAGE_SIZE items when size=999999 is requested', () => {
    const { items } = AuditService.listForEmployee('emp-clamp', { size: 999999 });

    expect(items.length).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    expect(items).toHaveLength(MAX_PAGE_SIZE);
  });

  it('reports the clamped size in the response so the caller sees the cap', () => {
    const { size } = AuditService.listForEmployee('emp-clamp', { size: 999999 });

    expect(size).toBe(MAX_PAGE_SIZE);
  });

  it('still honours the requested size when it sits under the clamp', () => {
    const { items, size } = AuditService.listForEmployee('emp-clamp', { size: 50 });

    expect(items).toHaveLength(50);
    expect(size).toBe(50);
  });

  it('reports the full total separately so callers can paginate further', () => {
    // The clamp limits one page, not the population. `total` must still
    // reflect every matching entry so the client knows pagination remains.
    const { total } = AuditService.listForEmployee('emp-clamp', { size: 999999 });

    expect(total).toBe(MAX_PAGE_SIZE + 25);
  });
});
