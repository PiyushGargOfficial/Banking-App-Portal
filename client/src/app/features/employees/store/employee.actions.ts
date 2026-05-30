import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Employee, EmployeeListResponse, EmployeeQuery, EmployeeStatus, EmployeeUpsert } from '@core/models/employee.model';
import { ApiError } from '@core/models/api-error.model';

/**
 * Employee actions grouped by source so dev-tools traces stay readable
 * (e.g. "[Employee/Page] Load List" vs "[Employee/API] Load List Success").
 */

export const EmployeePageActions = createActionGroup({
  source: 'Employee/Page',
  events: {
    'Load List': props<{ query: EmployeeQuery }>(),
    'Load One': props<{ id: string }>(),
    'Create': props<{ payload: EmployeeUpsert }>(),
    'Update': props<{ id: string; payload: EmployeeUpsert }>(),
    'Patch Status': props<{ id: string; status: EmployeeStatus }>(),
    'Delete': props<{ id: string }>(),
    'Clear Selected': emptyProps(),
    'Clear Error': emptyProps()
  }
});

export const EmployeeApiActions = createActionGroup({
  source: 'Employee/API',
  events: {
    'Load List Success': props<{ response: EmployeeListResponse }>(),
    'Load List Failure': props<{ error: ApiError }>(),

    'Load One Success': props<{ employee: Employee }>(),
    'Load One Failure': props<{ error: ApiError }>(),

    'Create Success': props<{ employee: Employee }>(),
    'Create Failure': props<{ error: ApiError }>(),

    'Update Success': props<{ employee: Employee }>(),
    'Update Failure': props<{ error: ApiError }>(),

    'Patch Status Success': props<{ employee: Employee }>(),
    'Patch Status Failure': props<{ error: ApiError }>(),

    'Delete Success': props<{ id: string }>(),
    'Delete Failure': props<{ error: ApiError }>()
  }
});
