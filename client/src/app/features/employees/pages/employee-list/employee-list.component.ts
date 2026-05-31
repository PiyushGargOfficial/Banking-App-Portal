import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { EmployeeFacade } from '../../store/employee.facade';
import { EmployeeFilterComponent } from '../../components/employee-filter/employee-filter.component';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { Employee, EmployeeQuery } from '@core/models/employee.model';

/**
 * Employee list page.
 *
 * Demonstrates the NgRx + Signals split that's become standard practice
 * in Angular 17+:
 *   - NgRx (via EmployeeFacade) is still the single source of truth for
 *     cross-component state. Actions / reducers / effects / selectors
 *     are untouched.
 *   - At the component boundary we convert facade observables to signals
 *     via `toSignal()`. That collapses the template from
 *       `@if (loading$ | async) { ... } @else { @if ((items$ | async); as items) ... }`
 *     to a simple flat `@if (loading()) ... @else if (items().length === 0) ...`
 *     and removes the "pipe in action expression" workaround we needed in
 *     the pagination click handlers.
 *   - Pure component-local UI state (query, confirm-delete flags) uses
 *     plain `signal()` because there's nothing global about it.
 *   - A `computed()` derives the pagination summary string from the page,
 *     total, and totalPages signals - memoised for free.
 */
@Component({
  selector: 'app-employee-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    EmployeeFilterComponent,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    ConfirmDialogComponent
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss'
})
export class EmployeeListComponent implements OnInit, OnDestroy {
  private readonly facade = inject(EmployeeFacade);
  private readonly destroy$ = new Subject<void>();

  // --- Bridge: NgRx observables -> Signals -----------------------------------
  // toSignal() automatically tears down its subscription when the component
  // is destroyed (via DestroyRef). The store still owns the data; we just
  // expose it to the template via a synchronous, change-detection-aware API.
  protected readonly items = toSignal(this.facade.items$, { initialValue: [] as Employee[] });
  protected readonly loading = toSignal(this.facade.loadingList$, { initialValue: false });
  protected readonly total = toSignal(this.facade.total$, { initialValue: 0 });
  protected readonly page = toSignal(this.facade.page$, { initialValue: 1 });
  protected readonly size = toSignal(this.facade.size$, { initialValue: 10 });
  protected readonly totalPages = toSignal(this.facade.totalPages$, { initialValue: 1 });

  // --- Derived view-model (computed) ----------------------------------------
  // The pagination footer string. Recomputes only when one of its inputs
  // changes, otherwise serves a cached value. Keeps the template clean.
  protected readonly pageSummary = computed(
    () => `${this.page()} / ${this.totalPages()} - ${this.total()} total`
  );

  // --- Component-local UI state (signal) ------------------------------------
  // None of this belongs in NgRx - it's purely about what this one page is
  // showing right now. signal() gives us granular updates without the
  // ceremony of a feature slice.
  protected readonly query = signal<EmployeeQuery>({
    page: 1,
    size: 10,
    sortBy: 'lastName',
    sortDir: 'asc'
  });
  protected readonly confirmOpen = signal(false);
  protected readonly pendingDelete = signal<Employee | null>(null);

  ngOnInit(): void {
    // Pick up any sticky query from a prior visit, then issue the initial load.
    this.facade.lastQuery$.pipe(takeUntil(this.destroy$)).subscribe((q) => {
      this.query.update((curr) => ({ ...curr, ...q }));
    });
    this.facade.loadList(this.query());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChanged(partial: Partial<EmployeeQuery>): void {
    this.query.update((q) => ({ ...q, ...partial }));
    this.facade.loadList(this.query());
  }

  onSort(column: NonNullable<EmployeeQuery['sortBy']>): void {
    this.query.update((q) => {
      const sameColumn = q.sortBy === column;
      return {
        ...q,
        sortBy: column,
        sortDir: sameColumn && q.sortDir === 'asc' ? 'desc' : 'asc',
        page: 1
      };
    });
    this.facade.loadList(this.query());
  }

  onPage(delta: number, totalPages: number): void {
    const current = this.query().page ?? 1;
    const next = Math.max(1, Math.min(totalPages, current + delta));
    if (next === current) return;
    this.query.update((q) => ({ ...q, page: next }));
    this.facade.loadList(this.query());
  }

  onPageSize(size: number): void {
    this.query.update((q) => ({ ...q, size, page: 1 }));
    this.facade.loadList(this.query());
  }

  requestDelete(employee: Employee): void {
    this.pendingDelete.set(employee);
    this.confirmOpen.set(true);
  }

  confirmDelete(): void {
    const pending = this.pendingDelete();
    if (pending) this.facade.delete(pending.employeeId);
    this.cancelDelete();
  }

  cancelDelete(): void {
    this.confirmOpen.set(false);
    this.pendingDelete.set(null);
  }

  /** Arrow indicator for the sort header. Reads the query signal. */
  sortIndicator(column: EmployeeQuery['sortBy']): string {
    const q = this.query();
    if (q.sortBy !== column) return '';
    return q.sortDir === 'asc' ? ' v' : ' ^';
  }
}
