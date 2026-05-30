import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AuditListResponse } from '@core/models/audit.model';

/**
 * Read-only HTTP wrapper for the per-employee audit log.
 *
 * No POST/PUT/PATCH/DELETE - audit entries are append-only and emitted on
 * the server by the employee/account services. Exposing a write endpoint
 * would defeat the entire point of an immutable trail.
 */
@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/employees`;

  /** GET /api/employees/:id/audit?page=&size= */
  listForEmployee(employeeId: string, page = 1, size = 50): Observable<AuditListResponse> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<AuditListResponse>(`${this.base}/${employeeId}/audit`, { params });
  }
}
