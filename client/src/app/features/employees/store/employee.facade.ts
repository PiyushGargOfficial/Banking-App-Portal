import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { EmployeePageActions } from './employee.actions';
import * as fromEmployees from './employee.selectors';
import { EmployeeQuery, EmployeeStatus, EmployeeUpsert } from '@core/models/employee.model';

/**
 * Facade over the employee NgRx feature.
 *
 * Components consume the facade rather than dispatching/selecting directly.
 * This:
 *   - keeps the public API stable when the store internals change
 *   - simplifies tests (mock one facade vs many selectors/actions)
 *   - keeps templates small and intention-revealing
 */
@Injectable({ providedIn: 'root' })
export class EmployeeFacade {
  private readonly store = inject(Store);

  // --- Selectors (observables) ----------------------------------------------
  readonly items$ = this.store.select(fromEmployees.selectItems);
  readonly total$ = this.store.select(fromEmployees.selectTotal);
  readonly page$ = this.store.select(fromEmployees.selectPage);
  readonly size$ = this.store.select(fromEmployees.selectSize);
  readonly lastQuery$ = this.store.select(fromEmployees.selectLastQuery);
  readonly totalPages$ = this.store.select(fromEmployees.selectTotalPages);
  readonly selected$ = this.store.select(fromEmployees.selectSelected);
  readonly loadingList$ = this.store.select(fromEmployees.selectLoadingList);
  readonly loadingOne$ = this.store.select(fromEmployees.selectLoadingOne);
  readonly saving$ = this.store.select(fromEmployees.selectSaving);
  readonly deleting$ = this.store.select(fromEmployees.selectDeleting);
  readonly error$ = this.store.select(fromEmployees.selectError);
  readonly isBusy$ = this.store.select(fromEmployees.selectIsBusy);

  // --- Commands (dispatchers) -----------------------------------------------
  loadList(query: EmployeeQuery): void {
    this.store.dispatch(EmployeePageActions.loadList({ query }));
  }

  loadOne(id: string): void {
    this.store.dispatch(EmployeePageActions.loadOne({ id }));
  }

  create(payload: EmployeeUpsert): void {
    this.store.dispatch(EmployeePageActions.create({ payload }));
  }

  update(id: string, payload: EmployeeUpsert): void {
    this.store.dispatch(EmployeePageActions.update({ id, payload }));
  }

  patchStatus(id: string, status: EmployeeStatus): void {
    this.store.dispatch(EmployeePageActions.patchStatus({ id, status }));
  }

  delete(id: string): void {
    this.store.dispatch(EmployeePageActions.delete({ id }));
  }

  clearSelected(): void {
    this.store.dispatch(EmployeePageActions.clearSelected());
  }

  clearError(): void {
    this.store.dispatch(EmployeePageActions.clearError());
  }
}
