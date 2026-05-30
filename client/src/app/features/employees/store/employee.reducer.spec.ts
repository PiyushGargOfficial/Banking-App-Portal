import { Employee, EmployeeListResponse } from '@core/models/employee.model';
import { EmployeeApiActions, EmployeePageActions } from './employee.actions';
import { employeeFeature, initialEmployeeState } from './employee.reducer';

const reducer = employeeFeature.reducer;

const empA: Employee = {
  employeeId: 'a',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@x.io',
  role: 'ADMIN',
  status: 'ACTIVE'
};
const empB: Employee = { ...empA, employeeId: 'b', firstName: 'Bea', email: 'bea@x.io' };

describe('employee reducer', () => {
  it('returns the initial state for an unknown action', () => {
    const state = reducer(undefined, { type: '@@UNKNOWN' } as any);
    expect(state).toEqual(initialEmployeeState);
  });

  it('sets loading + clears error on loadList', () => {
    const action = EmployeePageActions.loadList({ query: { page: 1, size: 10 } });
    const next = reducer({ ...initialEmployeeState, error: { title: 'x', status: 500 } }, action);

    expect(next.loadingList).toBeTrue();
    expect(next.error).toBeNull();
    expect(next.lastQuery).toEqual({ page: 1, size: 10 });
  });

  it('stores items + paging on loadListSuccess', () => {
    const response: EmployeeListResponse = { items: [empA, empB], total: 2, page: 1, size: 10 };
    const next = reducer(
      { ...initialEmployeeState, loadingList: true },
      EmployeeApiActions.loadListSuccess({ response })
    );

    expect(next.loadingList).toBeFalse();
    expect(next.items).toEqual([empA, empB]);
    expect(next.total).toBe(2);
  });

  it('prepends a newly created employee', () => {
    const start = { ...initialEmployeeState, items: [empB] };
    const next = reducer(start, EmployeeApiActions.createSuccess({ employee: empA }));
    expect(next.items[0]).toBe(empA);
    expect(next.saving).toBeFalse();
  });

  it('updates an existing employee in place', () => {
    const updated: Employee = { ...empA, lastName: 'Lovelace-King' };
    const start = { ...initialEmployeeState, items: [empA, empB], selected: empA };
    const next = reducer(start, EmployeeApiActions.updateSuccess({ employee: updated }));
    expect(next.items).toEqual([updated, empB]);
    expect(next.selected).toEqual(updated);
  });

  it('removes an employee on deleteSuccess and decrements total', () => {
    const start = {
      ...initialEmployeeState,
      items: [empA, empB],
      total: 2,
      selected: empA,
      deleting: true
    };
    const next = reducer(start, EmployeeApiActions.deleteSuccess({ id: 'a' }));
    expect(next.items).toEqual([empB]);
    expect(next.total).toBe(1);
    expect(next.selected).toBeNull();
    expect(next.deleting).toBeFalse();
  });

  it('records errors and clears the busy flags', () => {
    const error = { title: 'Validation Failed', status: 400 };
    const start = { ...initialEmployeeState, saving: true };
    const next = reducer(start, EmployeeApiActions.createFailure({ error }));
    expect(next.saving).toBeFalse();
    expect(next.error).toEqual(error);
  });
});
