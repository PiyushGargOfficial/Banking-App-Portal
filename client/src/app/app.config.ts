import { ApplicationConfig, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideState, provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideRouterStore, routerReducer } from '@ngrx/router-store';
import { APP_ROUTES } from './app.routes';
import { correlationIdInterceptor } from '@core/interceptors/correlation-id.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { employeeFeature } from '@features/employees/store/employee.reducer';
import { employeeEffects } from '@features/employees/store/employee.effects';
import { accountFeature } from '@features/accounts/store/account.reducer';
import { accountEffects } from '@features/accounts/store/account.effects';
import { environment } from '@env/environment';

/**
 * Application-level providers. We register everything here rather than in a
 * legacy NgModule because Angular 17 standalone bootstrap is the norm.
 *
 * Order matters slightly: HTTP interceptors execute outermost-first, so
 * `correlationIdInterceptor` runs before `errorInterceptor`, meaning the
 * error handler can read the cid that was attached just upstream.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })
    ),

    provideHttpClient(
      withFetch(),
      withInterceptors([correlationIdInterceptor, errorInterceptor])
    ),

    // NgRx store + per-feature slices. The `router` reducer is registered as
    // the root state slice; the rest are feature slices loaded eagerly so
    // selectors are wired up before any component mounts.
    provideStore({ router: routerReducer }),
    provideRouterStore(),
    provideState(employeeFeature),
    provideState(accountFeature),

    // provideEffects accepts either Type<EffectsClass>[] or one-or-more
    // Record<string, FunctionalEffect> objects via rest args. Our effect
    // bundles are records, so we pass them directly - do NOT spread their
    // values into an array, that would be neither a class nor a record.
    provideEffects(employeeEffects, accountEffects),

    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode() || !environment.enableNgrxDevtools,
      connectInZone: true
    })
  ]
};
