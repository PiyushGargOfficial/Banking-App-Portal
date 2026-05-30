import { Injectable, computed, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
  /** ms after which the toast auto-dismisses. 0 means sticky. */
  ttl: number;
}

/**
 * Lightweight toast notification store backed by a signal.
 *
 * Why signal-first instead of an NgRx feature slice:
 *   - Toasts are pure UI state - never persisted, never queried, never
 *     cross-referenced with anything else. NgRx is overkill: an action /
 *     reducer / selector / effect chain for a 5-second-lifetime label
 *     adds boilerplate for zero architectural payoff.
 *   - Signals give us granular, OnPush-friendly reactivity for free.
 *   - The service is the canonical example of "use NgRx for state that
 *     belongs in the store; use signals for state that's just UI plumbing".
 *
 * Producers (NgRx Effects, HTTP interceptors) call `success`/`error` etc.
 * Consumers (the global notification component) read `notifications()`
 * and `hasNotifications()`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly _notifications = signal<Notification[]>([]);

  /** Read-only accessor for templates. */
  readonly notifications = this._notifications.asReadonly();

  /**
   * Derived signal - true while at least one toast is on screen. Memoised
   * by computed() so repeated template reads don't re-evaluate the filter.
   * The notification host component can bind this to drive a wrapper
   * element's `aria-live` region visibility.
   */
  readonly hasNotifications = computed(() => this._notifications().length > 0);

  success(message: string, ttl = 3500): void { this.push('success', message, ttl); }
  info(message: string, ttl = 3500): void { this.push('info', message, ttl); }
  warning(message: string, ttl = 4500): void { this.push('warning', message, ttl); }
  error(message: string, ttl = 5500): void { this.push('error', message, ttl); }

  dismiss(id: number): void {
    this._notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(kind: NotificationKind, message: string, ttl: number): void {
    const id = this.nextId++;
    this._notifications.update((list) => [...list, { id, kind, message, ttl }]);
    if (ttl > 0) {
      // setTimeout outside Angular zone is fine - signal updates trigger CD.
      setTimeout(() => this.dismiss(id), ttl);
    }
  }
}
