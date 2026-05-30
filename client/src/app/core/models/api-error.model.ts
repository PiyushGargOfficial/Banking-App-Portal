// Normalised API error contract used across the app.
// Matches the RFC 7807 problem-details document the backend emits, with an
// optional `errors` array for field-level validation messages.

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiError {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: FieldError[];
  /** Correlation id pulled from the response header for log traceability. */
  correlationId?: string;
}
