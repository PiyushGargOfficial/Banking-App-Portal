import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Account, AccountCreate, AccountPatch } from '@core/models/account.model';
import { ApiError } from '@core/models/api-error.model';

export const AccountPageActions = createActionGroup({
  source: 'Account/Page',
  events: {
    'Load For Employee': props<{ employeeId: string }>(),
    Create: props<{ employeeId: string; payload: AccountCreate }>(),
    Update: props<{
      accountId: string;
      payload: {
        accountType: Account['accountType'];
        currency: Account['currency'];
        balance: number;
        status: Account['status'];
      };
    }>(),
    Patch: props<{ accountId: string; payload: AccountPatch }>(),
    Close: props<{ accountId: string }>(),
    Clear: emptyProps()
  }
});

export const AccountApiActions = createActionGroup({
  source: 'Account/API',
  events: {
    'Load For Employee Success': props<{ accounts: Account[] }>(),
    'Load For Employee Failure': props<{ error: ApiError }>(),

    'Create Success': props<{ account: Account }>(),
    'Create Failure': props<{ error: ApiError }>(),

    'Update Success': props<{ account: Account }>(),
    'Update Failure': props<{ error: ApiError }>(),

    'Patch Success': props<{ account: Account }>(),
    'Patch Failure': props<{ error: ApiError }>(),

    'Close Success': props<{ account: Account }>(),
    'Close Failure': props<{ error: ApiError }>()
  }
});
