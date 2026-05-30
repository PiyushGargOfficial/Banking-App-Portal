import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { EmployeeFacade } from '../../store/employee.facade';
import { EmployeeApiService } from '@core/services/employee-api.service';
import { uniqueEmailValidator } from '@core/validators/unique-email.validator';
import { nameFormatValidator } from '@core/validators/name-format.validator';
import { noWhitespaceValidator } from '@core/validators/no-whitespace.validator';
import {
  EMPLOYEE_ROLES,
  EMPLOYEE_STATUSES,
  Employee,
  EmployeeRole,
  EmployeeStatus,
  EmployeeUpsert
} from '@core/models/employee.model';
import { CanComponentDeactivate } from '@core/guards/unsaved-changes.guard';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

/**
 * Reactive form for creating / editing an employee.
 *
 * The same component handles both modes:
 *   - /employees/new           -> create
 *   - /employees/:id/edit      -> edit (pre-fills from facade.selected$)
 *
 * Validators:
 *   - required for firstName, lastName, role, status
 *   - email format + async unique-email check (excluding the current id in edit)
 *
 * The form-level error summary at the top echoes any server-side validation
 * errors from the problem-details `errors[]` array so they stay visible even
 * if the offending field is below the fold.
 */
@Component({
  selector: 'app-employee-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AsyncPipe, RouterLink, LoadingSpinnerComponent, PageHeaderComponent],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.scss'
})
export class EmployeeFormComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(EmployeeFacade);
  private readonly employeeApi = inject(EmployeeApiService);
  private readonly destroy$ = new Subject<void>();

  /** Set in ngOnInit from the route param. Empty -> create mode. */
  protected employeeId: string | null = null;
  protected readonly roles = EMPLOYEE_ROLES;
  protected readonly statuses = EMPLOYEE_STATUSES;

  /**
   * Strongly typed reactive form.
   *
   * Validator stack per field:
   *   firstName / lastName
   *     - required           : must be present
   *     - noWhitespaceValidator : rejects strings of pure whitespace ("   ")
   *     - minLength(2)       : at least two chars
   *     - maxLength(60)      : at most 60 chars
   *     - nameFormatValidator : letters, spaces, hyphens, apostrophes (Unicode-aware)
   *
   *   email
   *     - required
   *     - Validators.email  : RFC-ish format check
   *     - maxLength(120)
   *     - uniqueEmailValidator (async, debounced backend lookup)
   *
   *   role / status
   *     - required (selects default to a valid value but defensive anyway)
   */
  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [
      Validators.required,
      noWhitespaceValidator,
      Validators.minLength(2),
      Validators.maxLength(60),
      nameFormatValidator
    ]],
    lastName: ['', [
      Validators.required,
      noWhitespaceValidator,
      Validators.minLength(2),
      Validators.maxLength(60),
      nameFormatValidator
    ]],
    email: [
      '',
      {
        validators: [Validators.required, Validators.email, Validators.maxLength(120)],
        asyncValidators: [uniqueEmailValidator(this.employeeApi, () => this.employeeId ?? undefined)],
        updateOn: 'blur' as const
      }
    ],
    role: ['SUPPORT' as EmployeeRole, [Validators.required]],
    status: ['ACTIVE' as EmployeeStatus, [Validators.required]]
  });

  protected readonly saving$ = this.facade.saving$;
  protected readonly error$ = this.facade.error$;
  protected readonly loadingOne$ = this.facade.loadingOne$;

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('id');

    if (this.employeeId) {
      this.facade.loadOne(this.employeeId);
      this.facade.selected$.pipe(takeUntil(this.destroy$)).subscribe((emp) => {
        if (emp) this.patchFromEmployee(emp);
      });
    }
  }

  ngOnDestroy(): void {
    this.facade.clearError();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** CanDeactivate hook used by the unsaved-changes guard. */
  canDeactivate(): boolean {
    if (this.form.pristine || this.form.disabled) return true;
    return confirm('You have unsaved changes. Leave anyway?');
  }

  isEditMode(): boolean { return !!this.employeeId; }

  /** Submit handler. Marks all-touched so error messages show on first attempt. */
  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.form.pending) return;

    const payload: EmployeeUpsert = this.form.getRawValue();
    if (this.employeeId) {
      this.facade.update(this.employeeId, payload);
    } else {
      this.facade.create(payload);
    }
    // Mark form pristine so the canDeactivate guard doesn't prompt on the
    // navigation triggered by the success effect.
    this.form.markAsPristine();
  }

  /** Cancel returns to the list or detail page depending on mode. */
  onCancel(): void {
    if (this.employeeId) {
      this.router.navigate(['/employees', this.employeeId]);
    } else {
      this.router.navigate(['/employees']);
    }
  }

  /** Pre-fill the form when an employee is loaded for edit. */
  private patchFromEmployee(emp: Employee): void {
    this.form.patchValue({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      role: emp.role,
      status: emp.status
    });
    this.form.markAsPristine();
  }
}
