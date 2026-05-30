import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Attaches an `X-Correlation-Id` header to every outbound request so the
 * client log line and the server log line can be tied together when debugging.
 *
 * Uses `crypto.randomUUID` when available (modern browsers + http/https) and
 * falls back to a Math.random based id otherwise.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = generateId();
  const cloned = req.clone({
    setHeaders: { 'X-Correlation-Id': correlationId }
  });
  return next(cloned);
};

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  // Fallback - good enough for a correlation id in unsupported environments.
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
