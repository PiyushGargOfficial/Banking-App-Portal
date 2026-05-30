import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Account, AccountCreate, AccountPatch } from '@core/models/account.model';

/**
 * Account HTTP service. Mirrors the REST shape from the spec, with both
 * employee-scoped (list/create) and account-scoped (read/update/patch/delete)
 * endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET all accounts for an employee. */
  listForEmployee(employeeId: string): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.base}/employees/${employeeId}/accounts`);
  }

  /** POST create account under an employee. */
  create(employeeId: string, payload: AccountCreate): Observable<Account> {
    return this.http.post<Account>(`${this.base}/employees/${employeeId}/accounts`, payload);
  }

  /** GET single account. */
  getById(accountId: string): Observable<Account> {
    return this.http.get<Account>(`${this.base}/accounts/${accountId}`);
  }

  /** PUT full replace (used by the edit-account form). */
  update(accountId: string, payload: Omit<Account, 'accountId' | 'employeeId' | 'accountNumber' | 'createdAt' | 'updatedAt'>): Observable<Account> {
    return this.http.put<Account>(`${this.base}/accounts/${accountId}`, payload);
  }

  /** PATCH partial update (e.g. quick status toggle). */
  patch(accountId: string, payload: AccountPatch): Observable<Account> {
    return this.http.patch<Account>(`${this.base}/accounts/${accountId}`, payload);
  }

  /** DELETE soft-closes the account (per assignment spec). */
  close(accountId: string): Observable<Account> {
    return this.http.delete<Account>(`${this.base}/accounts/${accountId}`);
  }
}
