// Application bootstrap entry point.
// Uses the standalone bootstrap API introduced in Angular 14 and the
// streamlined application builder available in Angular 17.
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  // eslint-disable-next-line no-console
  console.error('[bootstrap] Failed to start the Banking Admin Portal', err)
);
