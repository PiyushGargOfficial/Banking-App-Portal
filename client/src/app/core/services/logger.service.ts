import { Injectable } from '@angular/core';
import { environment } from '@env/environment';

/**
 * Centralised logger. Wraps console so we can later swap in a remote sink
 * (e.g. Datadog, Sentry) without touching call sites. Logs are silenced in
 * production for `debug` level - error/warn always pass through.
 */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  debug(message: string, context?: Record<string, unknown>): void {
    if (!environment.production) {
      // eslint-disable-next-line no-console
      console.debug(`[debug] ${message}`, context ?? '');
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.info(`[info] ${message}`, context ?? '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.warn(`[warn] ${message}`, context ?? '');
  }

  error(message: string, context?: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.error(`[error] ${message}`, context ?? '');
  }
}
