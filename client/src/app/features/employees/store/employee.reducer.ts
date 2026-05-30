import { createFeature, createReducer, on } from '@ngrx/store';
import { Employee, EmployeeQuery } from '@core/models/employee.model';
import { ApiError } from '@core/models/api-error.model';
import { EmployeeApiActions, EmployeePageActions } from './employee.actions';

/**
 * Employee feature state.
 *
 * - `items` is the current (filtered, paged) list returned by the server.
 * - `total` is what the server reports for pagination UI.
 * - `selected` holds the currently-opened employee for the detail/edit page.
 * - `lastQuery` is preserved so a successful mutation can re-issue the last
 *   list query without the page needing to know about it.
 */
export interface EmployeeState {
  items: Employee[];
  total: number;
  page: number;
  size: number;
  lastQuery: EmployeeQuery;
  selected: Employee | null;
  loadingList: boolean;
  loadingOne: boolean;
  saving: boolean;
  deleting: boolean;
  error: ApiError | null;
}

export const initialEmployeeState: EmployeeState = {
  items: [],
  total: 0,
  page: 1,
  size: 10,
  lastQuery: { page: 1, size: 10, sortBy: 'lastName', sortDir: 'asc' },
  selected: null,
  loadingList: false,
  loadingOne: false,
  saving: false,
  deleting: false,
  error: null
};

/**
 * Wrapped with `createFeature` so NgRx auto-generates selectors for every
 * piece of state. Custom (memoised) selectors live in employee.selectors.ts
 * and compose these base selectors.
 */
export const employeeFeature = createFeature({
  name: 'employees',
  reducer: createReducer(
    initialEmployeeState,

    // --- List ----------------------------------------------------------------
    on(EmployeePageActions.loadList, (state, { query }) => ({
      ...state,
      loadingList: true,
      error: null,
      lastQuery: query
    })),
    on(EmployeeApiActions.loadListSuccess, (state, { response }) => ({
      ...state,
      items: response.items,
      total: response.total,
      page: response.page,
      size: response.size,
      loadingList: false
    })),
    on(EmployeeApiActions.loadListFailure, (state, { error }) => ({
      ...state,
      loadingList: false,
      error
    })),

    // --- Single --------------------------------------------------------------
    on(EmployeePageActions.loadOne, (state) => ({ ...state, loadingOne: true, error: null, selected: null })),
    on(EmployeeApiActions.loadOneSuccess, (state, { employee }) => ({
      ...state,
      selected: employee,
      loadingOne: false
    })),
    on(EmployeeApiActions.loadOneFailure, (state, { error }) => ({ ...state, loadingOne: false, error })),
    on(EmployeePageActions.clearSelected, (state) => ({ ...state, selected: null })),

    // --- Create / Update / Patch --------------------------------------------
    on(EmployeePageActions.create, EmployeePageActions.update, (state) => ({
      ...state,
      saving: true,
      error: null
    })),
    on(EmployeeApiActions.createSuccess, (state, { employee }) => ({
      ...state,
      saving: false,
      // Prepend so the user sees the new record immediately even before a re-fetch.
      items: [employee, ...state.items]
    })),
    on(EmployeeApiActions.updateSuccess, EmployeeApiActions.patchStatusSuccess, (state, { employee }) => ({
      ...state,
      saving: false,
      selected: state.selected?.employeeId === employee.employeeId ? employee : state.selected,
      items: state.items.map((e) => (e.employeeId === employee.employeeId ? employee : e))
    })),
    on(
      EmployeeApiActions.createFailure,
      EmployeeApiActions.updateFailure,
      EmployeeApiActions.patchStatusFailure,
      (state, { error }) => ({ ...state, saving: false, error })
    ),

    // --- Delete --------------------------------------------------------------
    on(EmployeePageActions.delete, (state) => ({ ...state, deleting: true, error: null })),
    on(EmployeeApiActions.deleteSuccess, (state, { id }) => ({
      ...state,
      deleting: false,
      items: state.items.filter((e) => e.employeeId !== id),
      total: Math.max(0, state.total - 1),
      selected: state.selected?.employeeId === id ? null : state.selected
    })),
    on(EmployeeApiActions.deleteFailure, (state, { error }) => ({
      ...state,
      deleting: false,
      error
    })),

    on(EmployeePageActions.clearError, (state) => ({ ...state, error: null }))
  )
});
