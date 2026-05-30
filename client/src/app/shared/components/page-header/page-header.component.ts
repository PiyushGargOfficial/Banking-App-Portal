import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Reusable page header. Takes a title + optional subtitle and projects
 * arbitrary actions (buttons) into the right slot.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">
          {{ title }}
          <span class="page-header__accent" aria-hidden="true"></span>
        </h1>
        @if (subtitle) {
          <p class="page-header__subtitle">{{ subtitle }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content></ng-content>
      </div>
    </header>
  `,
  styles: [`
    .page-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      justify-content: space-between;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-border-soft);
    }
    .page-header__text { flex: 1 1 320px; min-width: 0; }
    .page-header__title {
      position: relative;
      margin: 0;
      padding-bottom: 6px;
      word-break: break-word;
    }
    /* Short brand-coloured underline echoes TD's section-heading style. */
    .page-header__accent {
      position: absolute;
      left: 0; bottom: 0;
      width: 40px; height: 3px;
      background: var(--color-primary);
      border-radius: 3px;
    }
    .page-header__subtitle {
      margin: 12px 0 0;
      color: var(--color-text-muted);
      font-size: 14px;
      word-break: break-word;
    }
    .page-header__actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    /* Tablet portrait: drop the actions to a full-width row beneath the
       title so long employee names + 3 action buttons don't crowd. */
    @media (max-width: 768px) {
      .page-header { gap: 12px; margin-bottom: 20px; padding-bottom: 12px; }
      .page-header__text { flex-basis: 100%; }
      .page-header__actions { width: 100%; justify-content: flex-start; }
    }
  `]
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
