import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Generic confirmation modal. The host page owns the "open" flag and gets
 * notified on confirm/cancel via outputs.
 *
 * Accessibility - the dialog implements the WAI-ARIA `dialog` pattern in full:
 *   - role="dialog" + aria-modal="true" (screen readers treat the rest of the
 *     page as inert while open)
 *   - aria-labelledby points at the title so the dialog announces itself
 *   - Escape closes the dialog (keyboard equivalent of a backdrop click)
 *   - Focus moves to the dialog's cancel button when it opens (cancel is the
 *     less-destructive default, picked deliberately so an accidental Enter
 *     doesn't confirm a delete)
 *   - Tab + Shift+Tab cycle only between the dialog's own focusable elements
 *     (focus trap), so a keyboard user can't tab into the page behind it
 *   - Focus returns to the element that triggered the dialog when it closes,
 *     so the user lands back exactly where they were
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

/**
 * CSS selector for everything that should participate in the focus trap.
 * Covers the standard interactive elements plus anything with an explicit
 * positive tabindex. Items with tabindex="-1" are deliberately excluded
 * because they're meant to be programmatically focusable only.
 */
const FOCUSABLE_SELECTORS =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

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
           backdrop's dismiss handler; it carries no interactive semantics itself.
           keydown handles the Tab focus trap so neither Tab nor Shift+Tab can
           escape the dialog while it's open. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->
      <div
        #dialogEl
        class="dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'dlg-title-' + dialogId"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <h2 [id]="'dlg-title-' + dialogId" class="dialog__title">{{ title }}</h2>
        <p class="dialog__message">{{ message }}</p>
        <div class="dialog__actions">
          <button
            #cancelBtn
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
export class ConfirmDialogComponent implements OnChanges, AfterViewChecked {
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

  @ViewChild('dialogEl') private dialogEl?: ElementRef<HTMLElement>;
  @ViewChild('cancelBtn') private cancelBtn?: ElementRef<HTMLButtonElement>;

  /**
   * The element that had focus when the dialog opened. We restore focus
   * to it on close so the keyboard user lands back at the trigger (the
   * "Delete" button on the row, the "Close account" button, etc.).
   */
  private previouslyFocused: HTMLElement | null = null;

  /**
   * One-shot flag set in ngOnChanges; consumed in ngAfterViewChecked once
   * the dialog template has actually rendered. This is the classic
   * "the @ViewChild isn't available until after change-detection runs"
   * pattern - we can't focus an element that doesn't exist yet.
   */
  private needsInitialFocus = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    const becameOpen = changes['open'].currentValue === true && changes['open'].previousValue !== true;
    const becameClosed = changes['open'].currentValue === false && changes['open'].previousValue === true;

    if (becameOpen) {
      // Snapshot what the keyboard user was on before the dialog stole focus.
      // We deliberately capture this here in ngOnChanges (before render) so
      // the trigger element is still the activeElement, not the dialog.
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      this.needsInitialFocus = true;
    } else if (becameClosed) {
      // Restore focus to the trigger. Wrapped in setTimeout so we don't try
      // to focus while the dialog DOM is still being torn down.
      const target = this.previouslyFocused;
      this.previouslyFocused = null;
      if (target && typeof target.focus === 'function') {
        setTimeout(() => target.focus(), 0);
      }
    }
  }

  ngAfterViewChecked(): void {
    // Once the dialog template has rendered and the ViewChild is wired up,
    // move focus into the dialog. Cancel is the deliberate initial target:
    // an accidental Enter or click should NOT confirm a destructive action.
    if (this.needsInitialFocus && this.cancelBtn) {
      this.needsInitialFocus = false;
      this.cancelBtn.nativeElement.focus();
    }
  }

  /** Escape closes the dialog - the keyboard equivalent of a backdrop click. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.onCancel();
    }
  }

  /**
   * Focus trap. When Tab reaches the last focusable element, wrap back to
   * the first. When Shift+Tab reaches the first, wrap to the last. This
   * keeps the keyboard inside the dialog while it's open - the canonical
   * WAI-ARIA modal pattern.
   *
   * We compute the focusable list per keystroke so the trap stays correct
   * even if the dialog's content changes dynamically.
   */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.dialogEl) return;

    const focusables = Array.from(
      this.dialogEl.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    ).filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);

    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onConfirm(): void {
    this.confirmed.emit();
  }
  onCancel(): void {
    this.cancelled.emit();
  }
}
