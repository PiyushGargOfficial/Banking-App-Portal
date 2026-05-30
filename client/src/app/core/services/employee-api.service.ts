import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import {
  Employee,
  EmployeeListResponse,
  EmployeeQuery,
  EmployeeUpsert,
  EmployeeStatus
} from '@core/models/employee.model';

/**
 * Thin HTTP wrapper for the employees endpoints. Keeps URL construction and
 * query-string serialisation in one place so effects/components don't deal
 * with raw HttpClient details.
 *
 * Uses ALL HTTP verbs required by the assignment: GET, POST, PUT, PATCH, DELETE.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/employees`;

  /** GET list with search/filter/pagination/sort. */
  list(query: EmployeeQuery = {}): Observable<EmployeeListResponse> {
    let params = new HttpParams();
    // Append only defined, non-empty params to keep the URL clean.
    for (const [key, raw] of Object.entries(query)) {
      if (raw === undefined || raw === null || raw === '') continue;
      params = params.set(key, String(raw));
    }
    return this.http.get<EmployeeListResponse>(this.base, { params });
  }

  /** GET single employee. */
  getById(id: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.base}/${id}`);
  }

  /** POST create. */
  create(payload: EmployeeUpsert): Observable<Employee> {
    return this.http.post<Employee>(this.base, payload);
  }

  /** PUT full replace. */
  update(id: string, payload: EmployeeUpsert): Observable<Employee> {
    return this.http.put<Employee>(`${this.base}/${id}`, payload);
  }

  /** PATCH status toggle - illustrates partial update. */
  patchStatus(id: string, status: EmployeeStatus): Observable<Employee> {
    return this.http.patch<Employee>(`${this.base}/${id}`, { status });
  }

  /** DELETE employee (hard delete; backend cascades a soft-close on accounts). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Async availability check for the unique-email validator. Returns true if
   * the email is free. `excludeId` allows the current employee to keep their
   * existing email while editing.
   */
  isEmailAvailable(email: string, excludeId?: string): Observable<boolean> {
    let params = new HttpParams().set('email', email);
    if (excludeId) params = params.set('excludeId', excludeId);
    return this.http
      .get<{ available: boolean }>(`${this.base}/email-available`, { params })
      .pipe(map((r) => r.available));
  }
}
