import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { MoneyPipe } from '@shared/pipes/money.pipe';

/**
 * Per-currency subtotal + grand total tile shown above the account list.
 *
 * Total balance simply sums numeric balances across currencies (callout shown
 * in the UI). In a real app this would FX-convert into a base currency.
 */
@Component({
  selector: 'app-account-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyValuePipe, MoneyPipe, DecimalPipe],
  template: `
    <div class="summary-grid">
      @for (entry of subtotals | keyvalue; track entry.key) {
        <div class="tile">
          <div class="tile__label">Subtotal ({{ entry.key }})</div>
          <div class="tile__value">{{ entry.value | money: entry.key }}</div>
        </div>
      }
      <div class="tile tile--total">
        <div class="tile__label">Total balance (sum)</div>
        <div class="tile__value">{{ total | number: '1.2-2' }}</div>
        <div class="tile__note">Sum across currencies - not FX converted.</div>
      </div>
    </div>
  `,
  styles: [
    `
      .summary-grid {
        display: grid;
        /* Cap each tile so the 2-3 subtotal tiles don't stretch into a
         wall of whitespace on 2K / 4K monitors. */
        grid-template-columns: repeat(auto-fit, minmax(180px, 280px));
        justify-content: start;
        gap: 12px;
        margin-bottom: 16px;
      }
      .tile {
        background: var(--color-primary-soft);
        border-radius: var(--radius-md);
        padding: 12px 16px;
      }
      .tile--total {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
      }
      .tile__label {
        font-size: 12px;
        color: var(--color-text-muted);
      }
      .tile__value {
        font-size: 18px;
        font-weight: 600;
        margin-top: 4px;
      }
      .tile__note {
        font-size: 11px;
        color: var(--color-text-muted);
        margin-top: 4px;
      }

      /* Phone: drop the auto-fit minimum so two tiles always sit per row
       on a ~400px-wide container, and tighten the padding / value size. */
      @media (max-width: 480px) {
        .summary-grid {
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }
        .tile {
          padding: 10px 12px;
        }
        .tile__label {
          font-size: 11px;
        }
        .tile__value {
          font-size: 16px;
        }
        .tile__note {
          font-size: 10px;
        }
      }
    `
  ]
})
export class AccountSummaryComponent {
  @Input() subtotals: Record<string, number> = {};
  @Input() total = 0;
}
