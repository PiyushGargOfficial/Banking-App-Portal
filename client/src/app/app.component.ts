import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NotificationComponent } from '@shared/components/notification/notification.component';

/**
 * Root shell. Mirrors TD's retail web layout:
 *  - sticky green top bar with the brand mark on the left and primary nav inline
 *  - generous white-space below the header
 *  - global toast surface for NgRx-effect-driven notifications
 *
 * The brand mark is a CSS-only square - we don't reproduce TD's trademarked
 * logo asset, just echo the visual rhythm of a coloured square with stylised
 * initials. A real engagement would swap in the licensed image.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationComponent],
  template: `
    <a class="skip-link" href="#main">Skip to main content</a>

    <header class="app-header" role="banner">
      <div class="app-header__inner">
        <a routerLink="/employees" class="brand" aria-label="Banking Admin Portal home">
          <span class="brand__mark" aria-hidden="true">
            <span class="brand__mark-letters">TD</span>
          </span>
          <span class="brand__text">
            <span class="brand__name">Banking</span>
            <span class="brand__sub">Admin Portal</span>
          </span>
        </a>

        <nav aria-label="Primary navigation" class="nav">
          <!--
            aria-current="page" announces "current page" to screen readers when
            this link points at the current route. The visual "active" class
            already conveys that to sighted users; this gives the same signal
            to assistive tech. Bound off RouterLinkActive's #rla template ref
            so it stays in sync with the visual state automatically.
          -->
          <a
            routerLink="/employees"
            routerLinkActive="active"
            #rla="routerLinkActive"
            [attr.aria-current]="rla.isActive ? 'page' : null"
            class="nav-link"
            >Employees</a
          >
        </nav>

        <div class="header-meta" aria-hidden="true">
          <span class="header-meta__user">Admin</span>
        </div>
      </div>
    </header>

    <main id="main" class="container" tabindex="-1">
      <router-outlet></router-outlet>
    </main>

    <footer class="app-footer">
      <div class="app-footer__inner">
        <span>Banking Admin Portal</span>
        <span class="text-muted">Built by Piyush Garg</span>
      </div>
    </footer>

    <app-notification></app-notification>
  `,
  styleUrl: './app.component.scss'
})
export class AppComponent {}
