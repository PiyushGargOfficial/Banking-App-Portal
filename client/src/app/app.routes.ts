import { Routes } from '@angular/router';

/**
 * Top-level routes. Employee feature is lazy-loaded so the initial JS bundle
 * stays small. The default redirect lands the user on the list.
 */
export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'employees' },
  {
    path: 'employees',
    loadChildren: () =>
      import('@features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES)
  },
  { path: '**', redirectTo: 'employees' }
];
