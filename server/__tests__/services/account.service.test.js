/**
 * Unit tests for AccountService.
 *
 * Accounts are where the money + state transitions live, so this is the
 * highest-value service to pin down. Focus areas:
 *   - create() applies the domain defaults (status -> OPEN, balance -> 0)
 *   - the close / reopen status-flip rules pick the RIGHT audit narrative
 *     (CLOSE / REOPEN) instead of a generic UPDATE diff
 *   - missing-id paths return null (so the controller can map them to 404)
 *   - every write emits exactly the audit entry we expect, with the
 *     correlation id / actor forwarded through
 *
 * Mirrors the structure of employee.service.test.js: a clean store per test,
 * small fixture factories, and assertions against both the returned model and
 * the audit-log side effects.
 */
const { resetStore } = require('../helpers/reset-store');
const store = require('../../data/store');
const AccountService = require('../../services/account.service');

// --- Fixture helpers --------------------------------------------------------

const now = () => new Date().toISOString();

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

describe('AccountService.create - domain defaults', () => {
  const validBody = {
    accountNumber: '4023600000009999',
    accountType: 'SAVINGS',
    currency: 'USD',
    balance: 250.5
  };

  it('persists the account and returns it with a generated id', () => {
    const created = AccountService.create('emp-1', validBody, ctx);

    expect(created.accountId).toEqual(expect.any(String));
    expect(created.accountId.length).toBeGreaterThan(0);
    expect(created.employeeId).toBe('emp-1');
    expect(store.accounts).toHaveLength(1);
    expect(store.accounts[0]).toBe(created);
  });

  it('defaults status to OPEN', () => {
    const created = AccountService.create('emp-1', validBody, ctx);
    expect(created.status).toBe('OPEN');
  });

  it('defaults balance to 0 when omitted', () => {
    const { balance, ...noBalance } = validBody;
    const created = AccountService.create('emp-1', noBalance, ctx);
    expect(created.balance).toBe(0);
  });

  it('keeps an explicit balance of 0 (does not treat it as missing)', () => {
    const created = AccountService.create('emp-1', { ...validBody, balance: 0 }, ctx);
    expect(created.balance).toBe(0);
  });

  it('stamps createdAt and updatedAt timestamps', () => {
    const created = AccountService.create('emp-1', validBody, ctx);
    expect(created.createdAt).toEqual(expect.any(String));
    expect(created.updatedAt).toEqual(expect.any(String));
  });

  it('emits a single CREATE audit entry attributed to the account', () => {
    const created = AccountService.create('emp-1', validBody, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0]).toMatchObject({
      action: 'CREATE',
      resource: 'Account',
      resourceId: created.accountId,
      employeeId: 'emp-1',
      correlationId: 'cid-test-001',
      actor: 'tester'
    });
    expect(store.auditLog[0].snapshot.accountNumber).toBe(validBody.accountNumber);
  });
});

// ---------------------------------------------------------------------------

describe('AccountService.findById / listForEmployee / isAccountNumberTaken', () => {
  beforeEach(() => {
    store.accounts.push(
      makeAccount({ accountId: 'a1', employeeId: 'emp-1', accountNumber: '4023600000000001' }),
      makeAccount({ accountId: 'a2', employeeId: 'emp-1', accountNumber: '4023600000000002' }),
      makeAccount({ accountId: 'b1', employeeId: 'emp-2', accountNumber: '4023600000000003' })
    );
  });

  it('findById returns the matching account', () => {
    expect(AccountService.findById('a2').accountId).toBe('a2');
  });

  it('findById returns null for an unknown id', () => {
    expect(AccountService.findById('nope')).toBeNull();
  });

  it('listForEmployee returns only that employee accounts', () => {
    const list = AccountService.listForEmployee('emp-1');
    expect(list.map((a) => a.accountId).sort()).toEqual(['a1', 'a2']);
  });

  it('listForEmployee returns an empty array when the employee owns none', () => {
    expect(AccountService.listForEmployee('emp-nobody')).toEqual([]);
  });

  it('isAccountNumberTaken reflects whether the number exists', () => {
    expect(AccountService.isAccountNumberTaken('4023600000000001')).toBe(true);
    expect(AccountService.isAccountNumberTaken('0000000000000000')).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('AccountService.replace', () => {
  it('returns null when the account does not exist', () => {
    const result = AccountService.replace('missing', { balance: 1 }, ctx);
    expect(result).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });

  it('applies the new field values and bumps updatedAt', () => {
    const old = '2020-01-01T00:00:00.000Z';
    store.accounts.push(makeAccount({ accountId: 'acc-r', updatedAt: old, balance: 100 }));

    const after = AccountService.replace(
      'acc-r',
      { accountType: 'SAVINGS', currency: 'USD', balance: 999.99, status: 'OPEN' },
      ctx
    );

    expect(after.accountType).toBe('SAVINGS');
    expect(after.currency).toBe('USD');
    expect(after.balance).toBe(999.99);
    expect(after.updatedAt).not.toBe(old);
  });

  it('emits an UPDATE audit entry describing the field-level diff', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-r', balance: 100 }));

    AccountService.replace(
      'acc-r',
      { accountType: 'CHECKING', currency: 'CAD', balance: 500, status: 'OPEN' },
      ctx
    );

    const entry = store.auditLog.find((e) => e.action === 'UPDATE');
    expect(entry).toBeDefined();
    const balanceChange = entry.changes.find((c) => c.field === 'balance');
    expect(balanceChange).toEqual({ field: 'balance', before: 100, after: 500 });
  });

  it('does NOT emit an audit entry when nothing actually changed (no-op diff)', () => {
    store.accounts.push(
      makeAccount({
        accountId: 'acc-same',
        accountType: 'CHECKING',
        currency: 'CAD',
        balance: 100,
        status: 'OPEN'
      })
    );

    AccountService.replace(
      'acc-same',
      { accountType: 'CHECKING', currency: 'CAD', balance: 100, status: 'OPEN' },
      ctx
    );

    expect(store.auditLog.filter((e) => e.action === 'UPDATE')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('AccountService.patch - status-flip narratives', () => {
  it('returns null when the account does not exist', () => {
    expect(AccountService.patch('missing', { status: 'CLOSED' }, ctx)).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });

  it('records a CLOSE entry for a status-only flip to CLOSED', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-c', status: 'OPEN' }));

    const after = AccountService.patch('acc-c', { status: 'CLOSED' }, ctx);

    expect(after.status).toBe('CLOSED');
    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0].action).toBe('CLOSE');
  });

  it('records a REOPEN entry for a status-only flip back to OPEN', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-o', status: 'CLOSED' }));

    const after = AccountService.patch('acc-o', { status: 'OPEN' }, ctx);

    expect(after.status).toBe('OPEN');
    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0].action).toBe('REOPEN');
  });

  it('falls back to a generic UPDATE entry when more than status changes', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-u', status: 'OPEN', balance: 100 }));

    AccountService.patch('acc-u', { status: 'CLOSED', balance: 50 }, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0].action).toBe('UPDATE');
  });

  it('falls back to UPDATE when a non-status field is patched', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-b', balance: 100 }));

    AccountService.patch('acc-b', { balance: 200 }, ctx);

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0].action).toBe('UPDATE');
  });

  it('treats a status patch that does not change the value as a no-op (no audit entry)', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-noop', status: 'OPEN' }));

    AccountService.patch('acc-noop', { status: 'OPEN' }, ctx);

    // status didn't change -> not a flip, and the generic diff is empty -> no entry
    expect(store.auditLog).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('AccountService.close - soft close', () => {
  it('returns null when the account does not exist', () => {
    expect(AccountService.close('missing', ctx)).toBeNull();
    expect(store.auditLog).toHaveLength(0);
  });

  it('flips the status to CLOSED and bumps updatedAt', () => {
    const old = '2020-01-01T00:00:00.000Z';
    store.accounts.push(makeAccount({ accountId: 'acc-x', status: 'OPEN', updatedAt: old }));

    const closed = AccountService.close('acc-x', ctx);

    expect(closed.status).toBe('CLOSED');
    expect(closed.updatedAt).not.toBe(old);
  });

  it('never hard-deletes - the row still exists after close', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-keep', status: 'OPEN' }));

    AccountService.close('acc-keep', ctx);

    expect(store.accounts.find((a) => a.accountId === 'acc-keep')).toBeDefined();
  });

  it('emits a CLOSE audit entry with the correlation id forwarded', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-x', status: 'OPEN' }));

    AccountService.close('acc-x', { correlationId: 'cid-CLOSE', actor: 'reviewer' });

    expect(store.auditLog).toHaveLength(1);
    expect(store.auditLog[0]).toMatchObject({
      action: 'CLOSE',
      resource: 'Account',
      resourceId: 'acc-x',
      correlationId: 'cid-CLOSE',
      actor: 'reviewer'
    });
  });

  it('is idempotent at the data level - closing an already-CLOSED account stays CLOSED', () => {
    store.accounts.push(makeAccount({ accountId: 'acc-twice', status: 'CLOSED' }));

    const closed = AccountService.close('acc-twice', ctx);

    expect(closed.status).toBe('CLOSED');
  });
});
