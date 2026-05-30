import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { AccountPageActions } from './account.actions';
import * as fromAccounts from './account.selectors';
import { Account, AccountCreate, AccountPatch } from '@core/models/account.model';

/**
 * Facade for the accounts feature. Same rationale as the employee facade:
 * stable surface for components, easy to mock in tests.
 */
@Injectable({ providedIn: 'root' })
export class AccountFacade {
  private readonly store = inject(Store);

  readonly items$ = this.store.select(fromAccounts.selectItems);
  readonly openItems$ = this.store.select(fromAccounts.selectOpenAccounts);
  readonly subtotalsByCurrency$ = this.store.select(fromAccounts.selectSubtotalsByCurrency);
  readonly totalBalance$ = this.store.select(fromAccounts.selectTotalBalance);
  readonly loading$ = this.store.select(fromAccounts.selectLoading);
  readonly saving$ = this.store.select(fromAccounts.selectSaving);
  readonly closing$ = this.store.select(fromAccounts.selectClosing);
  readonly error$ = this.store.select(fromAccounts.selectError);

  loadForEmployee(employeeId: string): void {
    this.store.dispatch(AccountPageActions.loadForEmployee({ employeeId }));
  }

  create(employeeId: string, payload: AccountCreate): void {
    this.store.dispatch(AccountPageActions.create({ employeeId, payload }));
  }

  update(
    accountId: string,
    payload: { accountType: Account['accountType']; currency: Account['currency']; balance: number; status: Account['status'] }
  ): void {
    this.store.dispatch(AccountPageActions.update({ accountId, payload }));
  }

  patch(accountId: string, payload: AccountPatch): void {
    this.store.dispatch(AccountPageActions.patch({ accountId, payload }));
  }

  close(accountId: string): void {
    this.store.dispatch(AccountPageActions.close({ accountId }));
  }

  clear(): void {
    this.store.dispatch(AccountPageActions.clear());
  }
}
