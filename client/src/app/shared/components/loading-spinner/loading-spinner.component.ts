import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Tiny inline loading spinner. Lives in shared/ so list, detail and form
 * pages can all show a consistent "working..." state.
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="spinner" [style.width.px]="size" [style.height.px]="size" role="status" [attr.aria-label]="label">
      <span class="visually-hidden">{{ label }}</span>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .spinner {
      display: inline-block;
      border: 2px solid rgba(31, 78, 216, 0.2);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .visually-hidden {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LoadingSpinnerComponent {
  @Input() size = 18;
  @Input() label = 'Loading';
}
