import { CanDeactivateFn } from '@angular/router';

/**
 * Components that opt into the guard implement this interface and expose
 * a `canDeactivate()` predicate (typically: form pristine OR user confirms).
 */
export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Promise<boolean>;
}

/**
 * Generic canDeactivate guard. Lets components describe their own "is it safe
 * to navigate away?" logic rather than encoding it in the router config.
 */
export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  return component?.canDeactivate ? component.canDeactivate() : true;
};
