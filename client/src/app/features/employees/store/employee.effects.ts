import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, tap, withLatestFrom } from 'rxjs';
import { Store } from '@ngrx/store';
import { EmployeeApiService } from '@core/services/employee-api.service';
import { NotificationService } from '@core/services/notification.service';
import { ApiError } from '@core/models/api-error.model';
import { EmployeeApiActions, EmployeePageActions } from './employee.actions';
import { selectLastQuery } from './employee.selectors';

/**
 * Effects for the employee feature. Each effect maps a page action to one or
 * more API actions, keeping side-effects (HTTP, navigation, toasts) out of
 * components and reducers.
 */

// --- Load list ---------------------------------------------------------------
export const loadEmployeeList$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.loadList),
      // exhaustMap so rapid duplicate triggers (e.g. double click) are ignored
      // while a list call is in flight.
      exhaustMap(({ query }) =>
        api.list(query).pipe(
          map((response) => EmployeeApiActions.loadListSuccess({ response })),
          catchError((error: ApiError) => of(EmployeeApiActions.loadListFailure({ error })))
        )
      )
    ),
  { functional: true }
);

// --- Load one ---------------------------------------------------------------
export const loadEmployee$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.loadOne),
      mergeMap(({ id }) =>
        api.getById(id).pipe(
          map((employee) => EmployeeApiActions.loadOneSuccess({ employee })),
          catchError((error: ApiError) => of(EmployeeApiActions.loadOneFailure({ error })))
        )
      )
    ),
  { functional: true }
);

// --- Create -----------------------------------------------------------------
export const createEmployee$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.create),
      // exhaustMap so the user can't submit twice while the first save runs.
      exhaustMap(({ payload }) =>
        api.create(payload).pipe(
          map((employee) => EmployeeApiActions.createSuccess({ employee })),
          catchError((error: ApiError) => of(EmployeeApiActions.createFailure({ error })))
        )
      )
    ),
  { functional: true }
);

// After a successful create, navigate to the new employee's detail page and toast.
export const createEmployeeSuccessNavigation$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(EmployeeApiActions.createSuccess),
      tap(({ employee }) => {
        notify.success(`Employee ${employee.firstName} ${employee.lastName} created`);
        router.navigate(['/employees', employee.employeeId]);
      })
    ),
  { functional: true, dispatch: false }
);

// --- Update -----------------------------------------------------------------
export const updateEmployee$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.update),
      exhaustMap(({ id, payload }) =>
        api.update(id, payload).pipe(
          map((employee) => EmployeeApiActions.updateSuccess({ employee })),
          catchError((error: ApiError) => of(EmployeeApiActions.updateFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const updateEmployeeSuccessNavigation$ = createEffect(
  (actions$ = inject(Actions), router = inject(Router), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(EmployeeApiActions.updateSuccess),
      tap(({ employee }) => {
        notify.success('Employee updated');
        router.navigate(['/employees', employee.employeeId]);
      })
    ),
  { functional: true, dispatch: false }
);

// --- Patch status -----------------------------------------------------------
export const patchEmployeeStatus$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.patchStatus),
      mergeMap(({ id, status }) =>
        api.patchStatus(id, status).pipe(
          map((employee) => EmployeeApiActions.patchStatusSuccess({ employee })),
          catchError((error: ApiError) => of(EmployeeApiActions.patchStatusFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const patchEmployeeStatusSuccessToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(EmployeeApiActions.patchStatusSuccess),
      tap(({ employee }) => notify.success(`Employee marked ${employee.status}`))
    ),
  { functional: true, dispatch: false }
);

// --- Delete -----------------------------------------------------------------
export const deleteEmployee$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.delete),
      exhaustMap(({ id }) =>
        api.delete(id).pipe(
          map(() => EmployeeApiActions.deleteSuccess({ id })),
          catchError((error: ApiError) => of(EmployeeApiActions.deleteFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const deleteEmployeeSuccessFlow$ = createEffect(
  (
    actions$ = inject(Actions),
    router = inject(Router),
    notify = inject(NotificationService),
    store = inject(Store)
  ) =>
    actions$.pipe(
      ofType(EmployeeApiActions.deleteSuccess),
      withLatestFrom(store.select(selectLastQuery)),
      tap(() => {
        notify.success('Employee deleted');
        router.navigate(['/employees']);
      }),
      // Re-issue the last list query so totals/pagination stay accurate.
      // loadList is exhaustMap-backed, so a duplicate trigger is harmless.
      map(([, lastQuery]) => EmployeePageActions.loadList({ query: lastQuery }))
    ),
  { functional: true }
);

// --- Generic failure toast --------------------------------------------------
export const employeeFailureToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        EmployeeApiActions.loadListFailure,
        EmployeeApiActions.loadOneFailure,
        EmployeeApiActions.createFailure,
        EmployeeApiActions.updateFailure,
        EmployeeApiActions.patchStatusFailure,
        EmployeeApiActions.deleteFailure
      ),
      tap(({ error }) => notify.error(error.detail ?? error.title ?? 'Something went wrong'))
    ),
  { functional: true, dispatch: false }
);

/** Bundled object for convenient registration with `provideEffects()`. */
export const employeeEffects = {
  loadEmployeeList$,
  loadEmployee$,
  createEmployee$,
  createEmployeeSuccessNavigation$,
  updateEmployee$,
  updateEmployeeSuccessNavigation$,
  patchEmployeeStatus$,
  patchEmployeeStatusSuccessToast$,
  deleteEmployee$,
  deleteEmployeeSuccessFlow$,
  employeeFailureToast$
};
