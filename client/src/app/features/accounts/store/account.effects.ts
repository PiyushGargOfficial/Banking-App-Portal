import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, mergeMap, of, tap } from 'rxjs';
import { AccountApiService } from '@core/services/account-api.service';
import { NotificationService } from '@core/services/notification.service';
import { ApiError } from '@core/models/api-error.model';
import { AccountApiActions, AccountPageActions } from './account.actions';

export const loadAccounts$ = createEffect(
  (actions$ = inject(Actions), api = inject(AccountApiService)) =>
    actions$.pipe(
      ofType(AccountPageActions.loadForEmployee),
      // switchMap-like behaviour via mergeMap is fine - the page only triggers
      // this once per employee navigation, and effects re-entrancy is unlikely.
      mergeMap(({ employeeId }) =>
        api.listForEmployee(employeeId).pipe(
          map((accounts) => AccountApiActions.loadForEmployeeSuccess({ accounts })),
          catchError((error: ApiError) => of(AccountApiActions.loadForEmployeeFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const createAccount$ = createEffect(
  (actions$ = inject(Actions), api = inject(AccountApiService)) =>
    actions$.pipe(
      ofType(AccountPageActions.create),
      exhaustMap(({ employeeId, payload }) =>
        api.create(employeeId, payload).pipe(
          map((account) => AccountApiActions.createSuccess({ account })),
          catchError((error: ApiError) => of(AccountApiActions.createFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const updateAccount$ = createEffect(
  (actions$ = inject(Actions), api = inject(AccountApiService)) =>
    actions$.pipe(
      ofType(AccountPageActions.update),
      exhaustMap(({ accountId, payload }) =>
        api.update(accountId, payload).pipe(
          map((account) => AccountApiActions.updateSuccess({ account })),
          catchError((error: ApiError) => of(AccountApiActions.updateFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const patchAccount$ = createEffect(
  (actions$ = inject(Actions), api = inject(AccountApiService)) =>
    actions$.pipe(
      ofType(AccountPageActions.patch),
      mergeMap(({ accountId, payload }) =>
        api.patch(accountId, payload).pipe(
          map((account) => AccountApiActions.patchSuccess({ account })),
          catchError((error: ApiError) => of(AccountApiActions.patchFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const closeAccount$ = createEffect(
  (actions$ = inject(Actions), api = inject(AccountApiService)) =>
    actions$.pipe(
      ofType(AccountPageActions.close),
      exhaustMap(({ accountId }) =>
        api.close(accountId).pipe(
          map((account) => AccountApiActions.closeSuccess({ account })),
          catchError((error: ApiError) => of(AccountApiActions.closeFailure({ error })))
        )
      )
    ),
  { functional: true }
);

export const accountSuccessToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        AccountApiActions.createSuccess,
        AccountApiActions.updateSuccess,
        AccountApiActions.patchSuccess,
        AccountApiActions.closeSuccess
      ),
      tap((action) => {
        switch (action.type) {
          case AccountApiActions.createSuccess.type: notify.success('Account added'); break;
          case AccountApiActions.updateSuccess.type:
          case AccountApiActions.patchSuccess.type: notify.success('Account updated'); break;
          case AccountApiActions.closeSuccess.type:  notify.success('Account closed'); break;
        }
      })
    ),
  { functional: true, dispatch: false }
);

export const accountFailureToast$ = createEffect(
  (actions$ = inject(Actions), notify = inject(NotificationService)) =>
    actions$.pipe(
      ofType(
        AccountApiActions.loadForEmployeeFailure,
        AccountApiActions.createFailure,
        AccountApiActions.updateFailure,
        AccountApiActions.patchFailure,
        AccountApiActions.closeFailure
      ),
      tap(({ error }) => notify.error(error.detail ?? error.title ?? 'Account operation failed'))
    ),
  { functional: true, dispatch: false }
);

export const accountEffects = {
  loadAccounts$,
  createAccount$,
  updateAccount$,
  patchAccount$,
  closeAccount$,
  accountSuccessToast$,
  accountFailureToast$
};
