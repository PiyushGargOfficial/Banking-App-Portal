import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';
import { Action } from '@ngrx/store';
import { EmployeeApiService } from '@core/services/employee-api.service';
import { Employee, EmployeeListResponse } from '@core/models/employee.model';
import { EmployeeApiActions, EmployeePageActions } from './employee.actions';
import { loadEmployeeList$ } from './employee.effects';

/**
 * Effect test for the list loader. Demonstrates the standard pattern:
 *   - provide the actions$ stream via provideMockActions
 *   - stub the API service so no HTTP fires
 *   - feed an input action, assert the output action
 */
describe('loadEmployeeList$ effect', () => {
  let actions$: ReplaySubject<Action>;
  let api: jasmine.SpyObj<EmployeeApiService>;

  const emp: Employee = {
    employeeId: '1',
    firstName: 'Test',
    lastName: 'User',
    email: 't.user@x.io',
    role: 'SUPPORT',
    status: 'ACTIVE'
  };
  const response: EmployeeListResponse = { items: [emp], total: 1, page: 1, size: 10 };

  beforeEach(() => {
    actions$ = new ReplaySubject<Action>(1);
    api = jasmine.createSpyObj<EmployeeApiService>('EmployeeApiService', [
      'list',
      'getById',
      'create',
      'update',
      'patchStatus',
      'delete',
      'isEmailAvailable'
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        { provide: EmployeeApiService, useValue: api }
      ]
    });
  });

  it('maps loadList to loadListSuccess when the API resolves', (done) => {
    api.list.and.returnValue(of(response));
    // Functional effects are factory functions - call them inside an injection
    // context to wire up `inject()`-based dependencies, which yields the
    // observable we then subscribe to.
    const effect$ = TestBed.runInInjectionContext(
      loadEmployeeList$ as unknown as () => Observable<Action>
    );

    effect$.subscribe((action) => {
      expect(action).toEqual(EmployeeApiActions.loadListSuccess({ response }));
      expect(api.list).toHaveBeenCalledWith({ page: 1, size: 10 });
      done();
    });

    actions$.next(EmployeePageActions.loadList({ query: { page: 1, size: 10 } }));
  });

  it('maps loadList to loadListFailure when the API rejects', (done) => {
    const error = { title: 'Boom', status: 500 };
    api.list.and.returnValue(throwError(() => error));
    const effect$ = TestBed.runInInjectionContext(
      loadEmployeeList$ as unknown as () => Observable<Action>
    );

    effect$.subscribe((action) => {
      expect(action).toEqual(EmployeeApiActions.loadListFailure({ error }));
      done();
    });

    actions$.next(EmployeePageActions.loadList({ query: {} }));
  });
});
