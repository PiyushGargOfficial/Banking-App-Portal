import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '@core/services/notification.service';

/**
 * Global toast renderer. Subscribed to the NotificationService signal and
 * mounted once near the app root so any component / effect can push a toast.
 */
@Component({
  selector: 'app-notification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" aria-atomic="true">
      @for (n of notifications(); track n.id) {
        <div class="toast" [class]="'toast--' + n.kind" data-cy="toast">
          <span class="toast__msg">{{ n.message }}</span>
          <button type="button"
                  class="toast__close"
                  aria-label="Dismiss notification"
                  (click)="dismiss(n.id)">x</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toasts {
      position: fixed; top: 16px; right: 16px; z-index: 2000;
      display: flex; flex-direction: column; gap: 8px;
      max-width: 360px;
    }
    /* Phone portrait: pin to both edges so a 360px toast doesn't get
       clipped on a 375px iPhone SE. */
    @media (max-width: 480px) {
      .toasts {
        top: 12px;
        right: 12px;
        left: 12px;
        max-width: none;
      }
    }
    .toast {
      display: flex; gap: 12px; align-items: flex-start;
      background: white; border-left: 4px solid var(--color-primary);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-md);
      padding: 10px 12px; font-size: 13px; color: var(--color-text);
      animation: slidein 160ms ease-out;
    }
    .toast--success { border-left-color: var(--color-success); }
    .toast--error   { border-left-color: var(--color-danger); }
    .toast--warning { border-left-color: var(--color-warn); }
    .toast--info    { border-left-color: var(--color-primary); }
    .toast__msg { flex: 1; }
    .toast__close {
      background: transparent; border: 0; cursor: pointer;
      color: var(--color-text-muted); font-size: 14px; line-height: 1;
    }
    @keyframes slidein {
      from { opacity: 0; transform: translateX(10px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `]
})
export class NotificationComponent {
  private readonly notifier = inject(NotificationService);
  protected readonly notifications = this.notifier.notifications;

  dismiss(id: number): void { this.notifier.dismiss(id); }
}
