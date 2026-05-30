import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { EmployeeFormComponent } from './employee-form.component';
import { EmployeeFacade } from '../../store/employee.facade';
import { EmployeeApiService } from '@core/services/employee-api.service';

/**
 * Component test for the employee form. We mock the facade + api so we can
 * assert validation behaviour and dispatch wiring without spinning up NgRx.
 */
describe('EmployeeFormComponent', () => {
  let fixture: ComponentFixture<EmployeeFormComponent>;
  let component: EmployeeFormComponent;
  let facade: jasmine.SpyObj<EmployeeFacade>;
  let api: jasmine.SpyObj<EmployeeApiService>;

  beforeEach(async () => {
    facade = jasmine.createSpyObj<EmployeeFacade>(
      'EmployeeFacade',
      ['loadOne', 'create', 'update', 'patchStatus', 'delete', 'clearError', 'clearSelected'],
      {
        saving$: of(false),
        error$: of(null as any),
        loadingOne$: of(false),
        selected$: of(null as any)
      }
    );
    api = jasmine.createSpyObj<EmployeeApiService>('EmployeeApiService', ['isEmailAvailable']);
    api.isEmailAvailable.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [EmployeeFormComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: EmployeeFacade, useValue: facade },
        { provide: EmployeeApiService, useValue: api }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EmployeeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in create mode with a pristine form', () => {
    expect(component.isEditMode()).toBeFalse();
    expect(component['form'].pristine).toBeTrue();
  });

  it('marks required fields invalid when empty', () => {
    component['form'].controls.firstName.markAsTouched();
    expect(component['form'].controls.firstName.errors?.['required']).toBeTrue();
  });

  it('flags email format errors before submission', () => {
    component['form'].patchValue({ email: 'not-an-email' });
    component['form'].controls.email.markAsTouched();
    expect(component['form'].controls.email.errors?.['email']).toBeTrue();
  });

  it('does not dispatch when the form is invalid', () => {
    component.onSubmit();
    expect(facade.create).not.toHaveBeenCalled();
  });

  it('dispatches create with the form payload when valid', () => {
    component['form'].patchValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@x.io',
      role: 'MANAGER',
      status: 'ACTIVE'
    });
    // Async email validator resolves synchronously here because the stub
    // returns `of(true)`. Mark touched to trigger validation.
    component['form'].controls.email.markAsTouched();
    component['form'].updateValueAndValidity();

    component.onSubmit();

    expect(facade.create).toHaveBeenCalledTimes(1);
    expect(facade.create).toHaveBeenCalledWith(jasmine.objectContaining({ email: 'jane.doe@x.io' }));
  });

  it('canDeactivate returns true for a pristine form', () => {
    expect(component.canDeactivate()).toBeTrue();
  });
});
