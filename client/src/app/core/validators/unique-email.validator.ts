import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, debounceTime, distinctUntilChanged, first, map, of, switchMap, catchError } from 'rxjs';
import { EmployeeApiService } from '@core/services/employee-api.service';

/**
 * Async validator factory that calls the backend to check if an email is in use.
 *
 * Debounces and de-duplicates calls so we don't spam the API while the user
 * types, and returns null on transport errors so a flaky network doesn't
 * permanently block form submission (the backend will re-validate anyway).
 *
 * `excludeIdProvider` lets edit forms pass the current employee's id so the
 * employee's own email is considered "available".
 */
export function uniqueEmailValidator(
  api: EmployeeApiService,
  excludeIdProvider: () => string | undefined
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').toString().trim();
    if (!value) return of(null);

    return of(value).pipe(
      debounceTime(150),
      distinctUntilChanged(),
      switchMap((email) =>
        api.isEmailAvailable(email, excludeIdProvider()).pipe(
          map((available) => (available ? null : { emailTaken: true })),
          catchError(() => of(null))
        )
      ),
      first()
    );
  };
}
