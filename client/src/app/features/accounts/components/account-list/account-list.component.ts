import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { Account, AccountCreate, AccountStatus, AccountType, Currency } from '@core/models/account.model';
import { MaskAccountPipe } from '@shared/pipes/mask-account.pipe';
import { MoneyPipe } from '@shared/pipes/money.pipe';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { AccountFacade } from '../../store/account.facade';
import { AccountFormComponent } from '../account-form/account-form.component';
import { AccountSummaryComponent } from '../account-summary/account-summary.component';

/**
 * Account list panel rendered as a child of the EmployeeDetail page.
 *
 * Demonstrates the same NgRx + Signals split as the employee list:
 *   - Facade observables are bridged to signals via `toSignal()` so the
 *     template can read state synchronously.
 *   - Inline-form UI state (`showForm`, `editing`, `pendingClose`) is
 *     held in component-local `signal()`s rather than the NgRx store -
 *     none of this is meaningful outside this one card on the page.
 *   - A small `computed()` derives the form heading from `editing()`.
 *
 * The one exception: `saving$` stays as an Observable so it can be passed
 * down to the AccountFormComponent's `@Input() saving$` prop unchanged.
 */
@Component({
  selector: 'app-account-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MaskAccountPipe,
    MoneyPipe,
    LoadingSpinnerComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    AccountFormComponent,
    AccountSummaryComponent
  ],
  templateUrl: './account-list.component.html',
  styleUrl: './account-list.component.scss'
})
export class AccountListComponent implements OnInit, OnChanges, OnDestroy {
  private readonly facade = inject(AccountFacade);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) employeeId!: string;

  // --- Facade observables -> signals -----------------------------------------
  protected readonly items     = toSignal(this.facade.items$,               { initialValue: [] as Account[] });
  protected readonly loading   = toSignal(this.facade.loading$,             { initialValue: false });
  protected readonly subtotals = toSignal(this.facade.subtotalsByCurrency$, { initialValue: {} as Record<string, number> });
  protected readonly total     = toSignal(this.facade.totalBalance$,        { initialValue: 0 });

  // Kept as an Observable because it's passed straight to the AccountForm
  // child component, whose @Input is typed `Observable<boolean>`. We could
  // migrate the child to accept a signal but it's outside this card's scope.
  protected readonly saving$ = this.facade.saving$;

  // --- Component-local UI state (signal) -------------------------------------
  protected readonly showForm     = signal(false);
  protected readonly editing      = signal<Account | null>(null);
  protected readonly pendingClose = signal<Account | null>(null);

  // --- Derived view-model (computed) -----------------------------------------
  // `editing()` is read once per render even though the template references
  // the heading text via `formHeading()` - computed memoises the string.
  protected readonly formHeading = computed(() =>
    this.editing() ? 'Edit account' : 'New account'
  );

  ngOnInit(): void {
    this.facade.loadForEmployee(this.employeeId);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Parent (employee detail) can swap the employeeId when navigating
    // between detail pages without unmounting this component.
    if (changes['employeeId'] && !changes['employeeId'].firstChange) {
      this.facade.loadForEmployee(this.employeeId);
    }
  }

  ngOnDestroy(): void {
    this.facade.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  startAdd(): void {
    this.editing.set(null);
    this.showForm.set(true);
  }

  startEdit(account: Account): void {
    this.editing.set(account);
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.editing.set(null);
    this.showForm.set(false);
  }

  onCreate(payload: AccountCreate): void {
    this.facade.create(this.employeeId, payload);
    this.cancelForm();
  }

  onUpdate(payload: { accountType: AccountType; currency: Currency; balance: number; status: AccountStatus }): void {
    const editing = this.editing();
    if (!editing) return;
    this.facade.update(editing.accountId, payload);
    this.cancelForm();
  }

  requestClose(account: Account): void {
    this.pendingClose.set(account);
  }

  cancelClose(): void {
    this.pendingClose.set(null);
  }

  confirmClose(): void {
    const pending = this.pendingClose();
    if (pending) this.facade.close(pending.accountId);
    this.pendingClose.set(null);
  }

  /**
   * Re-opens a soft-closed account by patching its status back to OPEN.
   * Goes through the existing PATCH endpoint - the success/failure toasts
   * come from the accounts effects automatically.
   */
  reopen(account: Account): void {
    if (account.status !== 'CLOSED') return;
    this.facade.patch(account.accountId, { status: 'OPEN' });
  }

  trackById = (_: number, a: Account): string => a.accountId;
}
