# NgRx in the Banking Admin Portal

**A beginner-friendly walkthrough of how state management works in this project.**

---

## Table of contents

1. [The big idea](#1-the-big-idea)
2. [The five pieces, with files](#2-the-five-pieces-with-files)
3. [Actions — the tickets](#3-actions--the-tickets)
4. [Reducer — the menu board + update rules](#4-reducer--the-menu-board--update-rules)
5. [Selectors — read functions](#5-selectors--read-functions)
6. [Effects — the kitchen (where HTTP lives)](#6-effects--the-kitchen-where-http-lives)
7. [Facade — the waiter](#7-facade--the-waiter)
8. [The full lifecycle — clicking "Delete"](#8-the-full-lifecycle--clicking-delete-on-an-employee)
9. [Where it all wires together](#9-where-it-all-wires-together)
10. [Trade-offs](#10-the-trade-offs-so-you-know-when-to-reach-for-it)
11. [One-paragraph summary](#11-one-paragraph-to-remember)

---

## 1. The big idea

Imagine your app is a kitchen. Components are the customers who want food. Without NgRx, every customer goes into the kitchen themselves, opens the fridge, fries an egg, plates it, and brings it back. This works for one customer but gets chaotic with twenty — the fridge runs empty, two people are using the same pan, nobody knows who took the last bread roll.

**NgRx is the restaurant model.** Customers (components) write a *ticket* (action) describing what they want. The ticket goes to the kitchen (store + effects). The kitchen does the work, updates a single shared menu board (state), and customers just *look at the board* (selectors) to see what's available. Nobody touches the fridge directly.

The win: every change to state is visible, ordered, and replayable. Bugs become "look at the tickets in order" instead of "good luck finding which component mutated this."

---

## 2. The five pieces, with files

In this project, NgRx for **employees** lives in `client/src/app/features/employees/store/` and consists of five files. The **accounts** feature mirrors the same structure.

```
store/
├── employee.actions.ts     ← the tickets
├── employee.reducer.ts     ← the menu board (state) + rules for updating it
├── employee.selectors.ts   ← read functions for the menu board
├── employee.effects.ts     ← the kitchen (HTTP calls, navigation, toasts)
└── employee.facade.ts      ← the waiter (one object components talk to)
```

Each piece has one job. The whole point of NgRx is that these jobs stay separated.

---

## 3. Actions — the tickets

`employee.actions.ts` defines every "thing that can happen" to employees as a plain object with a `type` string and some data.

```ts
export const EmployeePageActions = createActionGroup({
  source: 'Employee/Page',
  events: {
    'Load List': props<{ query: EmployeeQuery }>(),
    'Delete':    props<{ id: string }>(),
    // ...
  }
});

export const EmployeeApiActions = createActionGroup({
  source: 'Employee/API',
  events: {
    'Load List Success': props<{ response: EmployeeListResponse }>(),
    'Delete Success':    props<{ id: string }>(),
    'Delete Failure':    props<{ error: ApiError }>(),
    // ...
  }
});
```

Two groups, two intents:

- **`EmployeePageActions`** = "the user did something" (clicked delete, typed in search, hit submit)
- **`EmployeeApiActions`** = "the server replied" (success or failure)

When you call `EmployeePageActions.delete({ id: '42' })`, that's just creating an object like `{ type: '[Employee/Page] Delete', id: '42' }`. It hasn't *done* anything yet — it's just a description.

The Redux DevTools browser extension shows a timeline of every action firing. That timeline is gold for debugging.

---

## 4. Reducer — the menu board + update rules

`employee.reducer.ts` holds the *shape* of employee state and rules for how each action changes it.

```ts
export interface EmployeeState {
  items: Employee[];           // the current list
  total: number;               // for pagination
  selected: Employee | null;   // the one open in detail view
  loadingList: boolean;        // is a list fetch in flight?
  saving: boolean;             // is a create/update in flight?
  error: ApiError | null;      // last error, for the form summary
  // ... and a few more
}
```

The reducer is a single function: **(current state, action) → next state**. It must be **pure** — no HTTP calls, no `Math.random()`, no mutating the old state. Just "given what we had and what happened, here's the new snapshot."

```ts
on(EmployeePageActions.loadList, (state, { query }) => ({
  ...state,
  loadingList: true,      // flip on the spinner
  error: null,            // clear any old error
  lastQuery: query
})),

on(EmployeeApiActions.loadListSuccess, (state, { response }) => ({
  ...state,
  items: response.items,  // replace the list
  total: response.total,
  loadingList: false      // flip off the spinner
})),
```

Notice the pattern: we always return a *new* object with `...state` spread first. Never `state.items.push(...)` — that would mutate.

---

## 5. Selectors — read functions

`employee.selectors.ts` gives components clean, memoised getters into state.

```ts
export const selectItems       = ...;  // gives you Employee[]
export const selectLoadingList = ...;  // gives you boolean
export const selectTotalPages  = createSelector(
  selectTotal,
  selectSize,
  (total, size) => Math.max(1, Math.ceil(total / size))
);
```

The `createSelector` for `selectTotalPages` is doing something smart: it only re-runs the `Math.ceil` calculation when `total` *or* `size` actually changes. If a different part of state updates, it returns the cached previous result. That memoisation is what keeps NgRx fast.

---

## 6. Effects — the kitchen (where HTTP lives)

The reducer can't make network calls (it has to be pure). So `employee.effects.ts` handles all the side-effecty stuff: HTTP requests, router navigation, showing toasts.

An effect is "when I see action X, do some async work, then dispatch action Y."

```ts
export const loadEmployeeList$ = createEffect(
  (actions$ = inject(Actions), api = inject(EmployeeApiService)) =>
    actions$.pipe(
      ofType(EmployeePageActions.loadList),            // listen for this
      exhaustMap(({ query }) =>
        api.list(query).pipe(                          // do HTTP
          map((response) => EmployeeApiActions.loadListSuccess({ response })),
          catchError((error) => of(EmployeeApiActions.loadListFailure({ error })))
        )
      )
    ),
  { functional: true }
);
```

Translation in English:

> Whenever a `Load List` action fires, call the API. If it succeeds, fire a `Load List Success` action with the data. If it fails, fire `Load List Failure` with the error.

That success/failure action then hits the reducer, which updates `items` and `loadingList`, which causes the UI to re-render. Full circle.

Some effects don't dispatch anything — they just react. Example:

```ts
export const deleteEmployeeSuccessFlow$ = createEffect(
  (actions$, router, notify, store) =>
    actions$.pipe(
      ofType(EmployeeApiActions.deleteSuccess),
      tap(() => {
        notify.success('Employee deleted');     // show a toast
        router.navigate(['/employees']);        // go back to the list
      }),
      map(([, lastQuery]) => EmployeePageActions.loadList({ query: lastQuery }))
    )
);
```

This one toasts, navigates, *and* re-fires the list query — all from a single trigger action.

---

## 7. Facade — the waiter

`employee.facade.ts` is one class components can inject. It hides the Store entirely.

```ts
@Injectable({ providedIn: 'root' })
export class EmployeeFacade {
  private readonly store = inject(Store);

  readonly items$       = this.store.select(selectItems);       // observable streams
  readonly loadingList$ = this.store.select(selectLoadingList);
  readonly saving$      = this.store.select(selectSaving);

  loadList(query: EmployeeQuery): void {
    this.store.dispatch(EmployeePageActions.loadList({ query }));
  }
  delete(id: string): void {
    this.store.dispatch(EmployeePageActions.delete({ id }));
  }
}
```

This is optional — components could talk to the Store directly. But the facade has two big wins:

1. **Components don't import actions or selectors**, so when you refactor the store internals (rename an action, restructure state) only the facade changes.
2. **Tests stub one object**, not a Store + several selectors + several action creators.

In the employee-list component:

```ts
constructor() {
  this.facade = inject(EmployeeFacade);
  this.items$ = this.facade.items$;        // observable to render in the template
}

onDelete(id: string) {
  this.facade.delete(id);                  // one method call, no NgRx knowledge needed
}
```

Clean.

---

## 8. The full lifecycle — clicking "Delete" on an employee

This is the moment everything clicks. Let's trace what happens when the admin clicks Delete on Sara Khan's row.

```
1. Template: <button (click)="requestDelete(emp)">Delete</button>
                                  ↓
2. Component opens the confirm dialog. User clicks "Confirm".
                                  ↓
3. Component calls facade.delete('22222222-...')
                                  ↓
4. Facade dispatches:  { type: '[Employee/Page] Delete', id: '22222...' }
                                  ↓
                ┌─────────────────┴─────────────────┐
                ↓                                   ↓
5a. REDUCER sees the action.            5b. EFFECT `deleteEmployee$` sees the action.
    Returns new state:                      Calls api.delete('22222...').
    { ...state,                             ↓
      deleting: true,                       (HTTP DELETE /api/employees/22222...)
      error: null }                         ↓
    UI shows a busy state.                  Server returns 204 No Content.
                                            ↓
                                       Effect dispatches:
                                       { type: '[Employee/API] Delete Success',
                                         id: '22222...' }
                                            ↓
                ┌─────────────────────┬─────┴─────────────────┐
                ↓                     ↓                       ↓
6a. REDUCER again:        6b. `deleteEmployeeSuccessFlow$`   6c. `employeeFailureToast$`
    Removes Sara from         effect runs:                     was listening for failure
    state.items.              - notify.success('Deleted')      actions — does nothing
    Sets deleting: false.     - router.navigate(['/employees'])here.
                              - re-dispatches loadList
                                ↓
7. Toast appears, page navigates, list refetches.
8. Sara is gone from the table. Spinner is off. Admin sees a green toast.
```

Notice how **no part of this knew about the others**:

- The reducer doesn't know about HTTP.
- The effect doesn't know how state is structured.
- The component doesn't know about reducers or effects.
- Every step is reversible by replaying the action list in DevTools.

---

## 9. Where it all wires together

In `client/src/app/app.config.ts`:

```ts
provideStore({ router: routerReducer }),           // create the global store
provideState(employeeFeature),                     // register the employees slice
provideState(accountFeature),                      // register the accounts slice
provideEffects(employeeEffects, accountEffects),   // register effects to run
provideStoreDevtools({ ... }),                     // enable browser dev tools
```

That's the only place the NgRx pieces meet each other.

---

## 10. The trade-offs (so you know when to reach for it)

**Use NgRx when:**

- Multiple components display or change the same data
- You have complex async flows (paged lists with filters, dependent loads, optimistic updates)
- You need a time-travel debugger to figure out what happened
- A team will work on the codebase and needs predictable patterns

**Skip NgRx when:**

- It's just one page calling one endpoint with no shared state — a plain `HttpClient` call in the component is fine
- Your "global state" is just a logged-in user object — Angular signals or a small service do the job with less ceremony

This project happens to be the first case: the employee list, detail view, form, and account panel all need to stay in sync; the form needs error state from the same place that handles HTTP failures; the delete flow has to refetch the list and navigate. NgRx earns its keep.

---

## 11. One paragraph to remember

> **Components dispatch actions. Reducers turn actions into new state. Effects do the side effects (HTTP, navigation, toasts). Selectors read state. The facade hides all of this behind a small, friendly API.** Data flows in one direction — never reach into the store and mutate it.

That sentence is 80% of NgRx. The other 20% is learning the RxJS operators (`switchMap`, `exhaustMap`, `mergeMap`, `catchError`) that show up inside effects — but those are general async toolbox skills you'll use everywhere, not NgRx-specific.

---

*Banking Admin Portal — internal documentation.*
