import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditApiService } from '@core/services/audit-api.service';
import { AuditEntry } from '@core/models/audit.model';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { MaskAccountPipe } from '@shared/pipes/mask-account.pipe';

/**
 * Append-only audit log for a single employee.
 *
 * Embedded as a child on the employee detail page. Owns its own local
 * fetch state via signals (loading / entries / error) - we deliberately
 * skip NgRx here because:
 *   1. the data is read-only
 *   2. it's only displayed in one place
 *   3. a full action/reducer/selector/effect/facade stack for a single
 *      GET endpoint would be ceremony without payoff
 *
 * The renderer pattern-matches on `entry.action` to choose the right
 * detail shape - snapshot, diff list, or simple label.
 */
@Component({
  selector: 'app-employee-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LoadingSpinnerComponent, EmptyStateComponent, MaskAccountPipe],
  templateUrl: './employee-audit-log.component.html',
  styleUrl: './employee-audit-log.component.scss'
})
export class EmployeeAuditLogComponent implements OnInit, OnChanges {
  private readonly api = inject(AuditApiService);

  @Input({ required: true }) employeeId!: string;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly total = signal(0);

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Parent (employee detail) can swap the id when the user navigates
    // between detail pages without unmounting this component.
    if (changes['employeeId'] && !changes['employeeId'].firstChange) {
      this.load();
    }
  }

  refresh(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listForEmployee(this.employeeId).subscribe({
      next: (res) => {
        this.entries.set(res.items);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.detail ?? err?.title ?? 'Failed to load audit log.');
        this.loading.set(false);
      }
    });
  }

  // ------ Helpers used by the template ------

  /** CSS class for the action badge. */
  badgeClass(action: AuditEntry['action']): string {
    switch (action) {
      case 'CREATE': return 'badge badge--create';
      case 'UPDATE': return 'badge badge--update';
      case 'DELETE': return 'badge badge--delete';
      case 'CLOSE': return 'badge badge--close';
      case 'REOPEN': return 'badge badge--reopen';
      case 'CASCADE_CLOSE': return 'badge badge--cascade';
    }
  }

  /** Human-readable label for the action badge. */
  actionLabel(action: AuditEntry['action']): string {
    switch (action) {
      case 'CASCADE_CLOSE': return 'CASCADE CLOSE';
      default: return action;
    }
  }

  /**
   * Render a primitive value for display. Strings stay strings, numbers
   * get formatted, booleans / null show literally. Avoids pulling in a
   * JSON pipe for what is almost always a single-token value.
   */
  formatValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (typeof value === 'number') return value.toString();
    return value.toString();
  }

  /** Pull a pretty list of "field: value, field: value" from a snapshot. */
  snapshotEntries(snapshot: Record<string, unknown> | undefined): Array<[string, unknown]> {
    if (!snapshot) return [];
    return Object.entries(snapshot);
  }
}
