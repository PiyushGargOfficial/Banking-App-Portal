import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NotificationService } from '@core/services/notification.service';

/**
 * Global toast renderer. Subscribed to the NotificationService signal and
 * mounted once near the app root so any component / effect can push a toast.
 *
 * Accessibility - the toast surface is split into two live regions by
 * severity:
 *
 *   - Errors (role="alert" + aria-live="assertive"): the screen reader
 *     interrupts whatever it's saying and announces the error immediately.
 *     This is the right call for "your save failed" or "the email is taken"
 *     - the user genuinely needs to know NOW.
 *
 *   - Success / info / warning (role="status" + aria-live="polite"): the
 *     screen reader finishes its current sentence then announces the toast.
 *     Right for "Employee saved" or "Account closed" - the user wants the
 *     confirmation but it's not urgent.
 *
 * Mixing both severities into a single polite region would mean errors
 * queue behind whatever was being narrated, sometimes for several seconds.
 */
@Component({
  selector: 'app-notification',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Single fixed-position host so the two live regions inside stack
      normally instead of overlapping. The aria-live regions sit one above
      the other as plain block children.
    -->
    <div class="toast-host">
      <!--
        Assertive region - only error toasts land here so screen readers
        interrupt and announce them immediately.
      -->
      <div class="toast-region" role="alert" aria-live="assertive" aria-atomic="true">
        @for (n of errorToasts(); track n.id) {
          <div class="toast toast--error" data-cy="toast">
            <span class="toast__msg">{{ n.message }}</span>
            <button
              type="button"
              class="toast__close"
              aria-label="Dismiss notification"
              (click)="dismiss(n.id)"
            >
              x
            </button>
          </div>
        }
      </div>

      <!--
        Polite region - success / info / warning toasts. The visual layout is
        identical to the assertive region above; the split is purely about
        WAI-ARIA semantics.
      -->
      <div class="toast-region" role="status" aria-live="polite" aria-atomic="true">
        @for (n of politeToasts(); track n.id) {
          <div class="toast" [class]="'toast--' + n.kind" data-cy="toast">
            <span class="toast__msg">{{ n.message }}</span>
            <button
              type="button"
              class="toast__close"
              aria-label="Dismiss notification"
              (click)="dismiss(n.id)"
            >
              x
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Single fixed-position container that holds both aria-live regions
         stacked vertically. The regions themselves are plain block flow so
         they don't fight each other for the same position. */
      .toast-host {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 360px;
        pointer-events: none; /* let clicks through gaps */
      }
      .toast-region {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      /* Empty live regions stay in the DOM (assistive tech expects them to
         persist) but contribute no visual gap. */
      .toast-region:empty {
        display: none;
      }
      .toast-region > .toast {
        pointer-events: auto;
      }
      /* Phone portrait: pin to both edges so a 360px toast doesn't get
       clipped on a 375px iPhone SE. */
      @media (max-width: 480px) {
        .toast-host {
          top: 12px;
          right: 12px;
          left: 12px;
          max-width: none;
        }
      }
      .toast {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        background: white;
        border-left: 4px solid var(--color-primary);
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-md);
        padding: 10px 12px;
        font-size: 13px;
        color: var(--color-text);
        animation: slidein 160ms ease-out;
      }
      .toast--success {
        border-left-color: var(--color-success);
      }
      .toast--error {
        border-left-color: var(--color-danger);
      }
      .toast--warning {
        border-left-color: var(--color-warn);
      }
      .toast--info {
        border-left-color: var(--color-primary);
      }
      .toast__msg {
        flex: 1;
      }
      .toast__close {
        background: transparent;
        border: 0;
        cursor: pointer;
        color: var(--color-text-muted);
        font-size: 14px;
        line-height: 1;
      }
      @keyframes slidein {
        from {
          opacity: 0;
          transform: translateX(10px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `
  ]
})
export class NotificationComponent {
  private readonly notifier = inject(NotificationService);
  protected readonly notifications = this.notifier.notifications;

  /**
   * Errors only - go into the assertive aria-live region so the screen
   * reader interrupts the user immediately. computed() memoises the filter
   * so the template can read this multiple times per render without cost.
   */
  protected readonly errorToasts = computed(() =>
    this.notifications().filter((n) => n.kind === 'error')
  );

  /** Success / info / warning - polite aria-live region. */
  protected readonly politeToasts = computed(() =>
    this.notifications().filter((n) => n.kind !== 'error')
  );

  dismiss(id: number): void {
    this.notifier.dismiss(id);
  }
}
