import { createSelector } from '@ngrx/store';
import { employeeFeature } from './employee.reducer';

/**
 * Re-export the auto-generated feature selectors and add a couple of composed
 * ones. Keeping derived view-model selectors in this file keeps components
 * free of state-shape knowledge.
 */
export const {
  selectEmployeesState,
  selectItems,
  selectTotal,
  selectPage,
  selectSize,
  selectLastQuery,
  selectSelected,
  selectLoadingList,
  selectLoadingOne,
  selectSaving,
  selectDeleting,
  selectError
} = employeeFeature;

/** Convenience: anything in progress at all? */
export const selectIsBusy = createSelector(
  selectLoadingList,
  selectLoadingOne,
  selectSaving,
  selectDeleting,
  (list, one, saving, deleting) => list || one || saving || deleting
);

/** Returns total pages so the pagination control doesn't recompute. */
export const selectTotalPages = createSelector(selectTotal, selectSize, (total, size) =>
  Math.max(1, Math.ceil(total / Math.max(1, size)))
);

/** Single-employee lookup; useful for sub-views that only know the id. */
export const selectEmployeeById = (id: string) =>
  createSelector(selectItems, (items) => items.find((e) => e.employeeId === id) ?? null);
