import { createFeature, createReducer, on } from '@ngrx/store';
import { Account } from '@core/models/account.model';
import { ApiError } from '@core/models/api-error.model';
import { AccountApiActions, AccountPageActions } from './account.actions';

/**
 * Accounts feature state.
 *
 * Scoped per "currently viewed" employee. Loading a different employee's
 * detail page resets `items` via `loadForEmployee` so we never accidentally
 * render stale accounts from another user.
 */
export interface AccountState {
  items: Account[];
  loading: boolean;
  saving: boolean;
  closing: boolean;
  error: ApiError | null;
}

export const initialAccountState: AccountState = {
  items: [],
  loading: false,
  saving: false,
  closing: false,
  error: null
};

export const accountFeature = createFeature({
  name: 'accounts',
  reducer: createReducer(
    initialAccountState,

    on(AccountPageActions.loadForEmployee, (state) => ({
      ...state,
      loading: true,
      error: null,
      items: []
    })),
    on(AccountApiActions.loadForEmployeeSuccess, (state, { accounts }) => ({
      ...state,
      loading: false,
      items: accounts
    })),
    on(AccountApiActions.loadForEmployeeFailure, (state, { error }) => ({
      ...state,
      loading: false,
      error
    })),

    on(AccountPageActions.create, AccountPageActions.update, AccountPageActions.patch, (state) => ({
      ...state,
      saving: true,
      error: null
    })),
    on(AccountApiActions.createSuccess, (state, { account }) => ({
      ...state,
      saving: false,
      items: [...state.items, account]
    })),
    on(AccountApiActions.updateSuccess, AccountApiActions.patchSuccess, (state, { account }) => ({
      ...state,
      saving: false,
      items: state.items.map((a) => (a.accountId === account.accountId ? account : a))
    })),
    on(
      AccountApiActions.createFailure,
      AccountApiActions.updateFailure,
      AccountApiActions.patchFailure,
      (state, { error }) => ({ ...state, saving: false, error })
    ),

    on(AccountPageActions.close, (state) => ({ ...state, closing: true, error: null })),
    on(AccountApiActions.closeSuccess, (state, { account }) => ({
      ...state,
      closing: false,
      items: state.items.map((a) => (a.accountId === account.accountId ? account : a))
    })),
    on(AccountApiActions.closeFailure, (state, { error }) => ({
      ...state,
      closing: false,
      error
    })),

    on(AccountPageActions.clear, () => initialAccountState)
  )
});
