import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Reusable empty-state block used by tables/lists when there is nothing to
 * display. Slots can be passed via content projection if a CTA is needed.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state" role="status">
      <div class="empty-state__icon" aria-hidden="true">{{ icon }}</div>
      <h3 class="empty-state__title">{{ title }}</h3>
      <p class="empty-state__message">{{ message }}</p>
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 32px 16px;
        text-align: center;
        border: 1px dashed var(--color-border);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .empty-state__icon {
        font-size: 28px;
      }
      .empty-state__title {
        margin: 0;
      }
      .empty-state__message {
        margin: 0;
        color: var(--color-text-muted);
      }
    `
  ]
})
export class EmptyStateComponent {
  @Input() icon = 'i';
  @Input() title = 'Nothing to show';
  @Input() message = '';
}
