import { Routes } from '@angular/router';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * Employee feature route table. Wired in app.routes.ts via `loadChildren` so
 * the entire feature ships in its own lazy chunk.
 *
 * The :id detail/edit pages route order matters - the literal `new` segment
 * is registered before `:id` so it isn't matched as an id.
 */
export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
    title: 'Employees - Banking Admin Portal'
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    canDeactivate: [unsavedChangesGuard],
    title: 'New Employee - Banking Admin Portal'
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/employee-detail/employee-detail.component').then(
        (m) => m.EmployeeDetailComponent
      ),
    title: 'Employee Detail - Banking Admin Portal'
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/employee-form/employee-form.component').then((m) => m.EmployeeFormComponent),
    canDeactivate: [unsavedChangesGuard],
    title: 'Edit Employee - Banking Admin Portal'
  }
];
