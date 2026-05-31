# Architecture Fundamentals — Are We Doing These, and How?

> A focused walkthrough for junior developers covering the **Architecture** and
> **Parent–Child relationship** requirements of the Angular-fundamentals spec.
> For each bullet: **are we doing it? (yes/no)** and **how**, with clickable file
> references.
>
> This is the deep dive on two sub-sections. Forms and HTTP are covered in the
> broader [ANGULAR_FUNDAMENTALS_GUIDE.md](./ANGULAR_FUNDAMENTALS_GUIDE.md).

**Verdict up front: ✅ every bullet is satisfied**, and a few are over-delivered
(lazy loading at two levels; both parent-child patterns used together).

---

## Table of contents

1. [Architecture](#1-architecture)
   - [1.1 Standalone + feature routes & clean folder structure](#11-standalone--feature-routes--clean-folder-structure)
   - [1.2 Lazy-loaded feature route(s)](#12-lazy-loaded-feature-routes)
   - [1.3 HTML + CSS (responsive for desktop/tablet)](#13-html--css-responsive-for-desktoptablet)
   - [1.4 Reusable component library (shared components folder)](#14-reusable-component-library-shared-components-folder)
2. [Parent–Child relationship](#2-parentchild-relationship)
   - [2.1 EmployeeDetail (parent) renders AccountList (child)](#21-employeedetail-parent-renders-accountlist-child)
   - [2.2 @Input/@Output AND the NgRx facade pattern](#22-inputoutput-and-the-ngrx-facade-pattern)
3. [Scorecard](#3-scorecard)
4. [Glossary](#4-glossary)

---

## 1. Architecture

### 1.1 Standalone + feature routes & clean folder structure

**Doing it? ✅ Yes.**

The spec allows "feature modules **OR** standalone + feature routes." This project
takes the modern path: **standalone components** (Angular 17+) — no `NgModule`
anywhere. Each component declares its own dependencies in an `imports: [...]`
array.

The folder structure is the classic, scalable split:

```
src/app/
├── core/          ← app-wide singletons: services, interceptors, guards, models, validators
├── shared/        ← dumb, reusable UI: components + pipes
└── features/      ← self-contained business areas
    ├── employees/ ← pages, components, store (NgRx)
    └── accounts/  ← components, store (NgRx)
```

**The rule of thumb for where code goes:**

| Folder | Meaning | Examples here |
|---|---|---|
| `core/` | Used **once**, app-wide | one logger, one error interceptor, the validators |
| `shared/` | Reusable **everywhere** | spinner, money pipe, confirm dialog |
| `features/` | One **slice of the domain** | everything employees; everything accounts |

Each feature owns its own pages, child components, and NgRx store. Delete the
`accounts/` folder and nothing in `employees/` breaks except one import — that
isolation is the sign of clean boundaries.

**Bootstrap is standalone too:** there's no `AppModule`. The app boots from
[main.ts](../client/src/main.ts) with `bootstrapApplication`, and all providers
live in [app.config.ts](../client/src/app/app.config.ts) (router, HttpClient,
NgRx store/effects, interceptors).

### 1.2 Lazy-loaded feature route(s)

**Doing it? ✅ Yes — at TWO levels** (more than the spec asks).

**Lazy loading** = the browser only downloads a feature's JavaScript when the user
actually navigates to it, keeping the first page load small.

**Level 1 — the whole employees feature** in
[app.routes.ts](../client/src/app/app.routes.ts):

```ts
{
  path: 'employees',
  loadChildren: () =>
    import('@features/employees/employees.routes').then((m) => m.EMPLOYEES_ROUTES)
}
```

`loadChildren` + dynamic `import()` means the employees code is **not** in the
initial bundle — it's fetched the first time someone visits `/employees`.

**Level 2 — each page inside the feature** in
[employees.routes.ts](../client/src/app/features/employees/employees.routes.ts):

```ts
{
  path: '',
  loadComponent: () =>
    import('./pages/employee-list/employee-list.component').then((m) => m.EmployeeListComponent),
}
```

So the list, detail, and form pages each ship as their **own** chunk. Open the
browser **Network tab** and navigate — you'll watch chunks load one at a time.

> **Gotcha worth knowing:** the `new` route is declared **before** `:id`. Route
> matching is top-down, so if `:id` came first, `/employees/new` would match
> `:id` with `id = "new"`. Order matters in route tables.

### 1.3 HTML + CSS (responsive for desktop/tablet)

**Doing it? ✅ Yes.**

Clean, semantic templates plus a deliberate responsive strategy.

- **Global stylesheet** [styles.scss](../client/src/styles.scss) documents a full breakpoint plan: reduction breakpoints at **1024 / 768 / 640 / 480px** (laptop → tablet → phone) and expansion tiers up to 4K. The container max-width grows and typography scales as the screen grows.
- **Component-level `@media` rules** handle local reflow — e.g. [page-header.component.ts](../client/src/app/shared/components/page-header/page-header.component.ts) drops its action buttons onto a full-width row under 768px so a long employee name + three buttons don't crowd on a tablet.
- Layout uses flex/grid utilities and `flex-wrap`, so cards and form grids collapse gracefully rather than overflowing.

The "desktop/tablet" requirement is comfortably met (the plan actually reaches
phones and 4K too).

### 1.4 Reusable component library (shared components folder)

**Doing it? ✅ Yes.**

[shared/components/](../client/src/app/shared/components/) is the reusable
"library." It holds five generic, presentational components:

`loading-spinner` · `empty-state` · `confirm-dialog` · `notification` · `page-header`

The model example is
[page-header.component.ts](../client/src/app/shared/components/page-header/page-header.component.ts):
it takes a `title`/`subtitle` via `@Input()` and uses **`<ng-content>`** to
project arbitrary buttons into its action slot:

```html
<div class="page-header__actions">
  <ng-content></ng-content>
</div>
```

That's why the **detail** page can drop "Back / Edit / Delete" into it while the
**form** page drops a single "Back to list" button into the *same* component — the
header knows nothing about employees, which is exactly what makes it reusable.
`confirm-dialog` is reused for both employee deletion and account closing.

There are also reusable **pipes** in
[shared/pipes/](../client/src/app/shared/pipes/): `money.pipe` and
`mask-account.pipe` (renders `••••7766`).

---

## 2. Parent–Child relationship

### 2.1 EmployeeDetail (parent) renders AccountList (child)

**Doing it? ✅ Yes — this is the exact example the spec names.**

In
[employee-detail.component.html](../client/src/app/features/employees/pages/employee-detail/employee-detail.component.html):

```html
<!-- Parent (detail) passes the employee id down to the child (account list). -->
<app-account-list class="mt-5" [employeeId]="emp.employeeId"></app-account-list>
```

The parent passes data **down** via an `@Input()`. In
[account-list.component.ts](../client/src/app/features/accounts/components/account-list/account-list.component.ts):

```ts
@Input({ required: true }) employeeId!: string;
```

**Three details a junior should notice:**

1. **`{ required: true }`** — Angular throws a compile error if a parent forgets
   to pass `employeeId`. The `!` ("definite assignment assertion") tells
   TypeScript "Angular sets this before use."
2. **Input changes are handled, not just the first value.** The child implements
   both `ngOnInit` *and* `ngOnChanges`:

   ```ts
   ngOnInit(): void { this.facade.loadForEmployee(this.employeeId); }
   ngOnChanges(changes: SimpleChanges): void {
     if (changes['employeeId'] && !changes['employeeId'].firstChange) {
       this.facade.loadForEmployee(this.employeeId);   // reload if parent swaps the id
     }
   }
   ```

   The `!firstChange` guard prevents a double-load (`ngOnChanges` also fires for
   the initial value, which `ngOnInit` already handled).
3. The detail page also renders an **audit-log child** the same way
   (`<app-employee-audit-log [employeeId]="...">`), so the parent-child pattern
   shows up more than once.

### 2.2 @Input/@Output AND the NgRx facade pattern

**Doing it? ✅ Yes — the spec says "@Input/@Output **OR** facade." This project uses BOTH.**

**`@Input` / `@Output`** between `AccountList` (parent) → `AccountForm` (child):
the form emits results back **up** via `@Output()` in
[account-form.component.ts](../client/src/app/features/accounts/components/account-form/account-form.component.ts):

```ts
@Output() create = new EventEmitter<AccountCreate>();
@Output() update = new EventEmitter<{...}>();
@Output() cancel = new EventEmitter<void>();
```

The parent listens with `(create)="onCreate($event)"`. That's the classic
**data-down / events-up** loop.

**Facade + NgRx** for the actual data: `AccountListComponent` injects
`AccountFacade` ([account.facade.ts](../client/src/app/features/accounts/store/account.facade.ts))
and reads/writes state through it, rather than owning the data itself. The facade
is a thin wrapper that hides the store's actions and selectors from the component.

So the wiring is **layered**:

```
EmployeeDetail (parent)
   │ [employeeId]  ──@Input down──►  AccountList (child of detail)
                                        │  injects ──►  AccountFacade ──► NgRx store (data)
                                        │ [existing]/[saving$] ──@Input down──► AccountForm (grandchild)
                                        ◄──@Output up── (create)/(update)/(cancel)
```

**NgRx supplies the data, `@Input` passes the id and props down, `@Output` carries
form results back up.** Using both patterns deliberately — facade for shared
state, `@Input`/`@Output` for local component communication — is exactly the
senior-level distinction the spec is probing for.

---

## 3. Scorecard

| Requirement | Status | Key evidence |
|---|---|---|
| Standalone + feature routes, clean folders | ✅ | `core`/`shared`/`features`; [main.ts](../client/src/main.ts) `bootstrapApplication` |
| Lazy-loaded feature route(s) | ✅ **(2 levels)** | `loadChildren` ([app.routes.ts](../client/src/app/app.routes.ts)) + `loadComponent` ([employees.routes.ts](../client/src/app/features/employees/employees.routes.ts)) |
| HTML + CSS responsive (desktop/tablet) | ✅ | [styles.scss](../client/src/styles.scss) breakpoints + component `@media` |
| Reusable component library | ✅ | [shared/components/](../client/src/app/shared/components/) (5 components) + pipes |
| EmployeeDetail (parent) → AccountList (child) | ✅ | `[employeeId]` `@Input` in [employee-detail.component.html](../client/src/app/features/employees/pages/employee-detail/employee-detail.component.html) |
| `@Input`/`@Output` **or** facade | ✅ **(both)** | AccountList ↔ AccountForm via `@Input`/`@Output`; data via `AccountFacade` |

---

## 4. Glossary

| Term | Plain-English meaning |
|---|---|
| **Standalone component** | A component that declares its own `imports`, no `NgModule` needed. |
| **Feature route** | A route table owned by one feature, wired into the app via `loadChildren`. |
| **Lazy loading** | Downloading a chunk of code only when the user navigates to it. |
| **`loadChildren` / `loadComponent`** | Lazy-load a feature's route table / a single component. |
| **`@Input()`** | A property a parent sets on a child — data flows **down**. |
| **`@Output()`** | An `EventEmitter` a child uses to notify its parent — events flow **up**. |
| **`ngOnChanges` / `firstChange`** | Lifecycle hook fired when an `@Input` changes; `firstChange` flags the initial set. |
| **Facade** | A thin service that hides NgRx actions/selectors behind simple methods + observables. |
| **`ng-content`** | A slot where a parent projects arbitrary markup into a child (content projection). |
| **Responsive / breakpoint** | CSS that adapts layout at specific screen widths (`@media`). |

---

*See also: [ANGULAR_FUNDAMENTALS_GUIDE.md](./ANGULAR_FUNDAMENTALS_GUIDE.md) (adds
Forms + HTTP), [NGRX_GUIDE.md](./NGRX_GUIDE.md), and
[ASSIGNMENT_COMPLIANCE_AUDIT.md](./ASSIGNMENT_COMPLIANCE_AUDIT.md).*
