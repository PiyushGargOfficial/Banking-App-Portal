import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '@core/services/logger.service';
import { ApiError } from '@core/models/api-error.model';

/**
 * Normalises HTTP errors into our internal `ApiError` shape and logs them
 * with the correlation id returned by the server.
 *
 * Async validators rely on observables NOT throwing for "valid" lookups, so
 * we only translate truly broken responses here - the normal validation 4xx
 * is still surfaced as an error so NgRx effects can react to it.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const correlationId =
        err.headers?.get('x-correlation-id') ?? req.headers.get('X-Correlation-Id') ?? undefined;

      // Try to map the backend's problem-details body into our ApiError.
      let apiError: ApiError;
      if (err.error && typeof err.error === 'object' && 'title' in err.error) {
        apiError = {
          ...(err.error as ApiError),
          status: (err.error as ApiError).status ?? err.status,
          correlationId
        };
      } else {
        apiError = {
          title: err.statusText || 'Network Error',
          status: err.status || 0,
          detail:
            err.status === 0
              ? 'Could not reach the API. Is the mock server running on port 3000?'
              : err.message,
          correlationId
        };
      }

      logger.error('HTTP error', {
        url: req.url,
        method: req.method,
        status: apiError.status,
        correlationId,
        detail: apiError.detail
      });

      return throwError(() => apiError);
    })
  );
};
