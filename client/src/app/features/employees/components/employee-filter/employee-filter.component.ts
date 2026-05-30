import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { EMPLOYEE_ROLES, EMPLOYEE_STATUSES, EmployeeQuery, HasAccountsFilter } from '@core/models/employee.model';

/**
 * Search/filter bar for the employee list page.
 *
 * - Emits `changed` with a partial `EmployeeQuery` whenever any field updates.
 * - The text search is debounced to avoid flooding the list reducer/effect
 *   while the admin is typing.
 * - The parent owns the query state; this component is purely presentational.
 */
@Component({
  selector: 'app-employee-filter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" class="filter card" role="search" aria-label="Filter employees">
      <div class="filter__field">
        <label for="search">Search</label>
        <input id="search" type="search" formControlName="search"
               placeholder="Name or email" data-cy="filter-search" />
      </div>

      <div class="filter__field">
        <label for="role">Role</label>
        <select id="role" formControlName="role" data-cy="filter-role">
          <option value="">All roles</option>
          @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
        </select>
      </div>

      <div class="filter__field">
        <label for="status">Status</label>
        <select id="status" formControlName="status" data-cy="filter-status">
          <option value="">Any status</option>
          @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
        </select>
      </div>

      <div class="filter__field">
        <label for="hasAccounts">Accounts</label>
        <select id="hasAccounts" formControlName="hasAccounts" data-cy="filter-accounts">
          <option value="">All employees</option>
          <option value="with">With accounts</option>
          <option value="without">Without accounts</option>
        </select>
      </div>

      <button type="button" class="btn btn-ghost" (click)="reset()" data-cy="filter-reset">
        Reset
      </button>
    </form>
  `,
  styles: [`
    .filter {
      display: grid;
      grid-template-columns: 1.6fr 1fr 1fr 1fr auto;
      gap: var(--space-3);
      align-items: end;
    }
    .filter__field label { font-size: 12px; color: var(--color-text-muted); }
    .filter__field { min-width: 0; }

    /* Laptop & tablet landscape: search keeps its width, selects share a row. */
    @media (max-width: 1024px) {
      .filter { grid-template-columns: 1fr 1fr 1fr 1fr; gap: var(--space-3) var(--space-2); }
      .filter > .filter__field:first-child { grid-column: span 4; }
      .filter button { grid-column: span 4; justify-self: end; }
    }
    /* Tablet portrait: 2 x 2 grid + reset on its own row. */
    @media (max-width: 768px) {
      .filter { grid-template-columns: 1fr 1fr; }
      .filter > .filter__field:first-child { grid-column: span 2; }
      .filter button { grid-column: span 2; justify-self: end; }
    }
    /* Phone: stack everything single-column. */
    @media (max-width: 480px) {
      .filter { grid-template-columns: 1fr; }
      .filter > .filter__field:first-child,
      .filter button { grid-column: span 1; justify-self: stretch; }
    }
  `]
})
export class EmployeeFilterComponent implements OnInit, OnDestroy {
  @Input() initialQuery: EmployeeQuery = {};
  @Output() changed = new EventEmitter<Partial<EmployeeQuery>>();

  protected readonly roles = EMPLOYEE_ROLES;
  protected readonly statuses = EMPLOYEE_STATUSES;

  protected readonly form = new FormGroup({
    search: new FormControl<string>('', { nonNullable: true }),
    role: new FormControl<string>('', { nonNullable: true }),
    status: new FormControl<string>('', { nonNullable: true }),
    hasAccounts: new FormControl<string>('', { nonNullable: true })
  });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.form.patchValue({
      search: this.initialQuery.search ?? '',
      role: this.initialQuery.role ?? '',
      status: this.initialQuery.status ?? '',
      hasAccounts: this.initialQuery.hasAccounts ?? ''
    }, { emitEvent: false });

    // Debounce the form as a whole - search typing benefits from it, and the
    // small delay on select changes is imperceptible while it de-dupes any
    // burst of valueChanges Angular fires during patchValue / reset.
    this.form.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.changed.emit({
          search: value.search?.trim() || undefined,
          role: (value.role as EmployeeQuery['role']) || undefined,
          status: (value.status as EmployeeQuery['status']) || undefined,
          hasAccounts: (value.hasAccounts as HasAccountsFilter) || undefined,
          page: 1 // any filter change resets back to page 1
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reset(): void {
    this.form.reset({ search: '', role: '', status: '', hasAccounts: '' });
  }
}
