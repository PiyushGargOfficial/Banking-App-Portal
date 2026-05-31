import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';
import { Action } from '@ngrx/store';
import { AccountApiService } from '@core/services/account-api.service';
import { Account } from '@core/models/account.model';
import { AccountApiActions, AccountPageActions } from './account.actions';
import { loadAccounts$, createAccount$, closeAccount$ } from './account.effects';

/**
 * Effect spec for the accounts slice. Mirrors employee.effects.spec.ts:
 *   - provide the actions$ stream via provideMockActions
 *   - stub AccountApiService so no HTTP fires
 *   - feed an input action, assert the mapped output action
 *
 * We cover the three effects with distinct RxJS flattening strategies
 * (load = mergeMap, create/close = exhaustMap) plus the success AND failure
 * branch of each, since the catchError mapping is the easiest thing to get
 * subtly wrong.
 */
describe('account effects', () => {
  let actions$: ReplaySubject<Action>;
  let api: jasmine.SpyObj<AccountApiService>;

  const account: Account = {
    accountId: 'a1',
    employeeId: 'e1',
    accountNumber: '4023600000000001',
    accountType: 'CHECKING',
    currency: 'CAD',
    balance: 100,
    status: 'OPEN'
  };

  beforeEach(() => {
    actions$ = new ReplaySubject<Action>(1);
    api = jasmine.createSpyObj<AccountApiService>('AccountApiService', [
      'listForEmployee',
      'create',
      'getById',
      'update',
      'patch',
      'close'
    ]);

    TestBed.configureTestingModule({
      providers: [provideMockActions(() => actions$), { provide: AccountApiService, useValue: api }]
    });
  });

  // Functional effects are factory functions: run them inside an injection
  // context so their inject()-based deps resolve, yielding the observable.
  const run = (effect: unknown) =>
    TestBed.runInInjectionContext(effect as () => Observable<Action>);

  describe('loadAccounts$', () => {
    it('maps loadForEmployee to loadForEmployeeSuccess when the API resolves', (done) => {
      api.listForEmployee.and.returnValue(of([account]));

      run(loadAccounts$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.loadForEmployeeSuccess({ accounts: [account] }));
        expect(api.listForEmployee).toHaveBeenCalledWith('e1');
        done();
      });

      actions$.next(AccountPageActions.loadForEmployee({ employeeId: 'e1' }));
    });

    it('maps to loadForEmployeeFailure when the API rejects', (done) => {
      const error = { title: 'Boom', status: 500 };
      api.listForEmployee.and.returnValue(throwError(() => error));

      run(loadAccounts$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.loadForEmployeeFailure({ error }));
        done();
      });

      actions$.next(AccountPageActions.loadForEmployee({ employeeId: 'e1' }));
    });
  });

  describe('createAccount$', () => {
    const payload = {
      accountNumber: '4023600000000099',
      accountType: 'SAVINGS' as const,
      currency: 'USD' as const,
      balance: 10
    };

    it('maps create to createSuccess when the API resolves', (done) => {
      api.create.and.returnValue(of(account));

      run(createAccount$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.createSuccess({ account }));
        expect(api.create).toHaveBeenCalledWith('e1', payload);
        done();
      });

      actions$.next(AccountPageActions.create({ employeeId: 'e1', payload }));
    });

    it('maps to createFailure when the API rejects', (done) => {
      const error = { title: 'Conflict', status: 409 };
      api.create.and.returnValue(throwError(() => error));

      run(createAccount$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.createFailure({ error }));
        done();
      });

      actions$.next(AccountPageActions.create({ employeeId: 'e1', payload }));
    });
  });

  describe('closeAccount$', () => {
    it('maps close to closeSuccess when the API resolves', (done) => {
      const closed: Account = { ...account, status: 'CLOSED' };
      api.close.and.returnValue(of(closed));

      run(closeAccount$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.closeSuccess({ account: closed }));
        expect(api.close).toHaveBeenCalledWith('a1');
        done();
      });

      actions$.next(AccountPageActions.close({ accountId: 'a1' }));
    });

    it('maps to closeFailure when the API rejects', (done) => {
      const error = { title: 'Not Found', status: 404 };
      api.close.and.returnValue(throwError(() => error));

      run(closeAccount$).subscribe((action) => {
        expect(action).toEqual(AccountApiActions.closeFailure({ error }));
        done();
      });

      actions$.next(AccountPageActions.close({ accountId: 'a1' }));
    });
  });
});
