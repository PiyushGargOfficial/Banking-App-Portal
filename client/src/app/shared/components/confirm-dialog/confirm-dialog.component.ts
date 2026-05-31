import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Generic confirmation modal. The host page owns the "open" flag and gets
 * notified on confirm/cancel via outputs.
 *
 * Keeping the dialog dumb (no global service / portal) makes it easier to
 * test in isolation and avoids tying the shared library to a particular
 * overlay implementation.
 *
 * Outputs use past-tense names (`confirmed` / `cancelled`) - this matches the
 * Angular style guide for event names, avoids shadowing `window.confirm` and
 * the native `cancel` DOM event, and keeps the strict template type-checker
 * happy (output aliases can be flaky under strictTemplates).
 */

// Module-level counter so each instance can build a stable, unique element id
// for the aria-labelledby relationship without touching a static class field
// from inside an instance initializer (which trips some strict-mode setups).
let nextDialogId = 0;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      The backdrop is a pointer-only convenience (click outside to dismiss).
      Keyboard users dismiss via Escape, handled by the host listener below, so
      the backdrop is intentionally not focusable and needs no key handler.
    -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <div *ngIf="open" class="backdrop" (click)="onCancel()" data-cy="confirm-backdrop">
      <!-- stopPropagation keeps a click *inside* the dialog from bubbling to the
           backdrop's dismiss handler; it carries no interactive semantics itself. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'dlg-title-' + dialogId"
        (click)="$event.stopPropagation()"
      >
        <h2 [id]="'dlg-title-' + dialogId" class="dialog__title">{{ title }}</h2>
        <p class="dialog__message">{{ message }}</p>
        <div class="dialog__actions">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="onCancel()"
            data-cy="confirm-cancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="destructive"
            [class.btn-primary]="!destructive"
            (click)="onConfirm()"
            data-cy="confirm-ok"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .dialog {
        background: white;
        border-radius: var(--radius-md);
        padding: 24px;
        max-width: 420px;
        width: calc(100% - 32px);
        box-shadow: var(--shadow-md);
      }
      .dialog__title {
        margin: 0 0 8px;
      }
      .dialog__message {
        margin: 0 0 20px;
        color: var(--color-text-muted);
      }
      .dialog__actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
    `
  ]
})
export class ConfirmDialogComponent {
  /** Unique id used to wire aria-labelledby to the title element. */
  readonly dialogId = ++nextDialogId;

  @Input() open = false;
  @Input() title = 'Are you sure?';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() destructive = false;

  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Escape closes the dialog - the keyboard equivalent of a backdrop click. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.onCancel();
    }
  }

  onConfirm(): void {
    this.confirmed.emit();
  }
  onCancel(): void {
    this.cancelled.emit();
  }
}
