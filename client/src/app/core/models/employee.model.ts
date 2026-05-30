// Strongly-typed contract for an Employee. Mirrors the backend persistence
// model and is reused across the feature, NgRx store and template layer.

/**
 * Primary-key type for an employee.
 *
 * Exported as its own alias (rather than inlined as `string`) so other models
 * can declare a foreign-key reference back to Employee just by using this
 * type - e.g. `Account.employeeId: EmployeeId`. That makes the FK
 * relationship obvious at a glance and keeps the canonical key definition in
 * one place: if it ever changes (UUID, branded type, number, etc.) every
 * downstream model picks up the new shape automatically.
 */
export type EmployeeId = string;

export type EmployeeRole = 'ADMIN' | 'SUPPORT' | 'MANAGER';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE';

export interface Employee {
  /** Primary key. Referenced as a foreign key by {@link Account.employeeId}. */
  employeeId: EmployeeId;
  firstName: string;
  lastName: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload used by create + update flows (no server-managed fields). */
export type EmployeeUpsert = Omit<Employee, 'employeeId' | 'createdAt' | 'updatedAt'>;

/** Server response envelope for the paginated employee list. */
export interface EmployeeListResponse {
  items: Employee[];
  total: number;
  page: number;
  size: number;
}

/**
 * `hasAccounts` filter on the employee list.
 *   - ''        -> all employees (no filtering by account count)
 *   - 'with'    -> employees who own at least one account record
 *   - 'without' -> employees who own no account records
 */
export type HasAccountsFilter = '' | 'with' | 'without';

/** Query string parameters supported by GET /api/employees. */
export interface EmployeeQuery {
  search?: string;
  role?: EmployeeRole | '';
  status?: EmployeeStatus | '';
  hasAccounts?: HasAccountsFilter;
  sortBy?: 'firstName' | 'lastName' | 'email' | 'role' | 'status';
  sortDir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export const EMPLOYEE_ROLES: EmployeeRole[] = ['ADMIN', 'SUPPORT', 'MANAGER'];
export const EMPLOYEE_STATUSES: EmployeeStatus[] = ['ACTIVE', 'INACTIVE'];
