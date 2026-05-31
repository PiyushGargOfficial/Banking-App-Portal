// Audit-log contract. Mirrors the entries the server appends per write.
//
// `AuditEntry` is a discriminated record - which optional fields are present
// depends on `action`:
//   - CREATE          -> snapshot
//   - UPDATE          -> changes[]
//   - DELETE          -> snapshot (pre-deletion)
//   - CLOSE / REOPEN  -> accountNumber
//   - CASCADE_CLOSE   -> accountNumber + reason
//
// The component layer pattern-matches on `action` to render the right detail.

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE' | 'REOPEN' | 'CASCADE_CLOSE';

export type AuditResource = 'Employee' | 'Account';

/** One field-level change inside an UPDATE entry. */
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEntry {
  entryId: string;
  /** FK back to the employee whose trail this entry belongs to. */
  employeeId: string;
  resource: AuditResource;
  /** Either the employeeId or the accountId, depending on `resource`. */
  resourceId: string;
  action: AuditAction;
  actor: string;
  correlationId: string | null;
  timestamp: string;

  // Action-shaped extras (see comment above).
  snapshot?: Record<string, unknown>;
  changes?: AuditChange[];
  accountNumber?: string;
  reason?: string;
}

/** Server response envelope for the paginated audit list. */
export interface AuditListResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  size: number;
}
