import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EmployeeApiService } from './employee-api.service';
import { Employee, EmployeeListResponse, EmployeeUpsert } from '@core/models/employee.model';

describe('EmployeeApiService', () => {
  let service: EmployeeApiService;
  let http: HttpTestingController;

  const sample: Employee = {
    employeeId: '42',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@x.io',
    role: 'MANAGER',
    status: 'ACTIVE'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EmployeeApiService
      ]
    });
    service = TestBed.inject(EmployeeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists employees with query params', () => {
    const response: EmployeeListResponse = { items: [sample], total: 1, page: 1, size: 10 };

    service.list({ search: 'jane', role: 'MANAGER', page: 1, size: 10 }).subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = http.expectOne((r) => r.url === '/api/employees');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('jane');
    expect(req.request.params.get('role')).toBe('MANAGER');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(response);
  });

  it('creates an employee via POST', () => {
    const payload: EmployeeUpsert = {
      firstName: 'Jane', lastName: 'Doe', email: 'jane@x.io', role: 'MANAGER', status: 'ACTIVE'
    };

    service.create(payload).subscribe((emp) => expect(emp).toEqual(sample));

    const req = http.expectOne('/api/employees');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(sample);
  });

  it('patches the status field via PATCH', () => {
    service.patchStatus('42', 'INACTIVE').subscribe();

    const req = http.expectOne('/api/employees/42');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'INACTIVE' });
    req.flush({ ...sample, status: 'INACTIVE' });
  });

  it('deletes an employee via DELETE', () => {
    service.delete('42').subscribe();

    const req = http.expectOne('/api/employees/42');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('reports email availability', () => {
    service.isEmailAvailable('new@x.io', '42').subscribe((available) => {
      expect(available).toBeTrue();
    });

    const req = http.expectOne((r) => r.url === '/api/employees/email-available');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('email')).toBe('new@x.io');
    expect(req.request.params.get('excludeId')).toBe('42');
    req.flush({ available: true });
  });
});
