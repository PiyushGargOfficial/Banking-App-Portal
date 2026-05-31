import { Account } from '@core/models/account.model';
import { AccountApiActions, AccountPageActions } from './account.actions';
import { accountFeature, initialAccountState } from './account.reducer';

/**
 * Reducer spec for the accounts slice. Mirrors employee.reducer.spec.ts:
 * each test drives one action against a known starting state and asserts the
 * resulting slice. The accounts slice tracks three independent busy flags
 * (loading / saving / closing), so the key thing to pin down is that each
 * action toggles the RIGHT flag and leaves the others alone.
 */
const reducer = accountFeature.reducer;

const accA: Account = {
  accountId: 'a',
  employeeId: 'e1',
  accountNumber: '4023600000000001',
  accountType: 'CHECKING',
  currency: 'CAD',
  balance: 100,
  status: 'OPEN'
};
const accB: Account = {
  ...accA,
  accountId: 'b',
  accountNumber: '4023600000000002',
  currency: 'USD',
  balance: 50
};

describe('account reducer', () => {
  it('returns the initial state for an unknown action', () => {
    const state = reducer(undefined, { type: '@@UNKNOWN' } as any);
    expect(state).toEqual(initialAccountState);
  });

  it('sets loading + clears items/error on loadForEmployee', () => {
    const start = {
      ...initialAccountState,
      items: [accA],
      error: { title: 'x', status: 500 }
    };
    const next = reducer(start, AccountPageActions.loadForEmployee({ employeeId: 'e1' }));

    expect(next.loading).toBeTrue();
    expect(next.error).toBeNull();
    expect(next.items).toEqual([]); // cleared so we never flash another employee's accounts
  });

  it('stores items on loadForEmployeeSuccess', () => {
    const start = { ...initialAccountState, loading: true };
    const next = reducer(
      start,
      AccountApiActions.loadForEmployeeSuccess({ accounts: [accA, accB] })
    );

    expect(next.loading).toBeFalse();
    expect(next.items).toEqual([accA, accB]);
  });

  it('records the error on loadForEmployeeFailure', () => {
    const error = { title: 'Boom', status: 500 };
    const next = reducer(
      { ...initialAccountState, loading: true },
      AccountApiActions.loadForEmployeeFailure({ error })
    );

    expect(next.loading).toBeFalse();
    expect(next.error).toEqual(error);
  });

  it('sets saving on create / update / patch', () => {
    for (const action of [
      AccountPageActions.create({ employeeId: 'e1', payload: {} as any }),
      AccountPageActions.update({ accountId: 'a', payload: {} as any }),
      AccountPageActions.patch({ accountId: 'a', payload: {} })
    ]) {
      const next = reducer({ ...initialAccountState, error: { title: 'x', status: 1 } }, action);
      expect(next.saving).toBeTrue();
      expect(next.error).toBeNull();
    }
  });

  it('appends the new account on createSuccess', () => {
    const start = { ...initialAccountState, items: [accA], saving: true };
    const next = reducer(start, AccountApiActions.createSuccess({ account: accB }));

    expect(next.items).toEqual([accA, accB]);
    expect(next.saving).toBeFalse();
  });

  it('replaces the matching account in place on updateSuccess / patchSuccess', () => {
    const updated: Account = { ...accA, balance: 999 };
    const start = { ...initialAccountState, items: [accA, accB], saving: true };

    const afterUpdate = reducer(start, AccountApiActions.updateSuccess({ account: updated }));
    expect(afterUpdate.items).toEqual([updated, accB]);
    expect(afterUpdate.saving).toBeFalse();

    const afterPatch = reducer(start, AccountApiActions.patchSuccess({ account: updated }));
    expect(afterPatch.items).toEqual([updated, accB]);
  });

  it('clears the saving flag and records the error on a save failure', () => {
    const error = { title: 'Validation Failed', status: 400 };
    const next = reducer(
      { ...initialAccountState, saving: true },
      AccountApiActions.createFailure({ error })
    );
    expect(next.saving).toBeFalse();
    expect(next.error).toEqual(error);
  });

  it('sets the closing flag (not saving) on close', () => {
    const next = reducer(initialAccountState, AccountPageActions.close({ accountId: 'a' }));
    expect(next.closing).toBeTrue();
    expect(next.saving).toBeFalse();
  });

  it('replaces the closed account in place on closeSuccess', () => {
    const closed: Account = { ...accA, status: 'CLOSED' };
    const start = { ...initialAccountState, items: [accA, accB], closing: true };
    const next = reducer(start, AccountApiActions.closeSuccess({ account: closed }));

    expect(next.items[0].status).toBe('CLOSED');
    expect(next.items[1]).toEqual(accB);
    expect(next.closing).toBeFalse();
  });

  it('clears the closing flag and records the error on closeFailure', () => {
    const error = { title: 'Conflict', status: 409 };
    const next = reducer(
      { ...initialAccountState, closing: true },
      AccountApiActions.closeFailure({ error })
    );
    expect(next.closing).toBeFalse();
    expect(next.error).toEqual(error);
  });

  it('resets to the initial state on clear', () => {
    const start = { ...initialAccountState, items: [accA, accB], error: { title: 'x', status: 1 } };
    const next = reducer(start, AccountPageActions.clear());
    expect(next).toEqual(initialAccountState);
  });
});
