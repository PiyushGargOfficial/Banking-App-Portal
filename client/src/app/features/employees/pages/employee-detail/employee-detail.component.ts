import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, takeUntil } from 'rxjs';
import { EmployeeFacade } from '../../store/employee.facade';
import { Employee } from '@core/models/employee.model';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { AccountListComponent } from '@features/accounts/components/account-list/account-list.component';
import { EmployeeAuditLogComponent } from '../../components/employee-audit-log/employee-audit-log.component';

const DEFAULT_TITLE = 'Banking Admin Portal';

/**
 * Employee detail page.
 *
 * Same NgRx + Signals split as the list page, plus one extra showcase:
 *
 *   `effect()` reactively syncs `document.title` to the loaded employee.
 *
 * That's the textbook use case for effects - a side-effect (DOM mutation
 * outside Angular's render cycle) that's tied to a piece of state. Doing
 * the same job with NgRx would mean an action / reducer / effect chain
 * just to write one string to the document. effect() runs the dependency
 * tracking automatically: whenever `employee()` changes, the title
 * updates; when the component is torn down, the effect is disposed via
 * DestroyRef so we don't leak a subscription.
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    ConfirmDialogComponent,
    AccountListComponent,
    EmployeeAuditLogComponent
  ],
  templateUrl: './employee-detail.component.html',
  styleUrl: './employee-detail.component.scss'
})
export class EmployeeDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly facade = inject(EmployeeFacade);
  private readonly destroy$ = new Subject<void>();

  // --- Facade observables -> signals -----------------------------------------
  protected readonly employee = toSignal(this.facade.selected$, {
    initialValue: null as Employee | null
  });
  protected readonly loading = toSignal(this.facade.loadingOne$, { initialValue: false });
  protected readonly deleting = toSignal(this.facade.deleting$, { initialValue: false });

  // --- Component-local UI state ----------------------------------------------
  protected employeeId: string | null = null;
  protected readonly confirmOpen = signal(false);

  constructor() {
    // Side-effect on state: keep the browser tab title in sync with the
    // currently-loaded employee. effect() automatically:
    //   - tracks `this.employee()` as a dependency
    //   - re-runs when that signal updates
    //   - is destroyed when the component is destroyed (via DestroyRef)
    effect(() => {
      const emp = this.employee();
      document.title = emp ? `${emp.firstName} ${emp.lastName} - ${DEFAULT_TITLE}` : DEFAULT_TITLE;
    });
  }

  ngOnInit(): void {
    // Re-run when the :id param changes, so navigating between detail pages
    // (e.g. via search) actually refetches.
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      const id = p.get('id');
      if (id && id !== this.employeeId) {
        this.employeeId = id;
        this.facade.loadOne(id);
      }
    });
  }

  ngOnDestroy(): void {
    // Restore the default tab title on the way out so subsequent pages
    // don't inherit a stale "Sara Khan - Banking Admin Portal".
    document.title = DEFAULT_TITLE;
    this.facade.clearSelected();
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleStatus(emp: Employee): void {
    this.facade.patchStatus(emp.employeeId, emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
  }

  requestDelete(): void {
    this.confirmOpen.set(true);
  }
  cancelDelete(): void {
    this.confirmOpen.set(false);
  }

  confirmDelete(emp: Employee): void {
    this.confirmOpen.set(false);
    this.facade.delete(emp.employeeId);
    // Effect handles toast + navigation back to list.
  }

  navigateBack(): void {
    this.router.navigate(['/employees']);
  }
}
