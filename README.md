# Banking Admin Portal

A small **Banking Admin Portal** that lets an admin manage **Employees** and their linked banking **Accounts**. Built as a take-home for the Senior Angular Developer role.

The project is split into:

```
banking-admin-portal/
├── server/    # Express mock HTTP API (in-memory, all REST verbs)
└── client/    # Angular 17 standalone app with NgRx + Cypress
```

---

## 1. Prerequisites

| Tool          | Version             | Notes                                       |
|---------------|--------------------|---------------------------------------------|
| **Node.js**   | `>= 20.11 LTS`     | Required by Angular 17 toolchain. Node 22 LTS is also supported. Node 18 reached EOL in April 2025 and is no longer accepted. |
| **npm**       | `>= 10`            | Bundled with Node 20.                       |
| **Chrome**    | latest             | Karma tests use `ChromeHeadless`.           |
| **Git**       | any recent         | For cloning / commits.                      |

> Pinned via `engines` in each `package.json`. `npm install` will warn if you're on an older Node.
> Tested on Node 20.x and 22.x.

---

## 2. Install dependencies

From the project root (`banking-admin-portal/`) run **once**:

```bash
npm run install:all
```

This installs:
- root tooling (`concurrently`)
- `server/` dependencies (`express`, `cors`, `morgan`, `uuid`)
- `client/` dependencies (Angular, NgRx, Cypress, Karma, Jasmine)

---

## 3. Run the app

```bash
npm start
```

This concurrently starts:

| Service              | URL                          | Notes                                                   |
|---------------------|------------------------------|---------------------------------------------------------|
| Express mock API    | <http://localhost:3000>      | Seeded with 3 employees + 3 accounts on every restart.  |
| Angular dev server  | <http://localhost:4200>      | Proxies `/api/*` to the mock API (see `proxy.conf.json`).|

Open <http://localhost:4200> in your browser.

To start just one side:

```bash
npm run start:server   # Express only
npm run start:client   # Angular only
```

---

## 4. Run the tests

```bash
# Frontend unit tests (Karma + Jasmine, headless Chrome)
npm test

# Backend unit tests (Jest)
npm run test:server                      # one-shot
npm run test:server:watch                # watch mode
npm run test:server:coverage             # with coverage report

# Both at once (CI-style)
npm run test:all

# Cypress (requires `npm start` to be running in another shell)
npm run e2e                              # headless
npm --prefix client run e2e:open         # interactive runner
```

### Frontend unit tests

| Layer       | File                                                                |
|-------------|---------------------------------------------------------------------|
| Reducer     | `employees/store/employee.reducer.spec.ts`                          |
| Effect      | `employees/store/employee.effects.spec.ts`                          |
| Service     | `core/services/employee-api.service.spec.ts`                        |
| Form (UI)   | `employees/pages/employee-form/employee-form.component.spec.ts`     |

### Backend unit tests (Jest)

The two highest-risk service files are covered end to end:

| File | What's covered |
|---|---|
| `server/__tests__/services/audit.service.test.js` | **Diff computation** (no-op writes return `null`, single/multi field diffs, untracked fields ignored), CREATE/DELETE snapshot shape, CLOSE/REOPEN/CASCADE_CLOSE narratives, context defaults (`actor=admin`, `correlationId=null`), `listForEmployee` ordering + pagination |
| `server/__tests__/services/employee.service.test.js` | **Remove cascade rules** - `remove()` returns false for unknown ids, deletes the employee, flips OPEN accounts to CLOSED, emits exactly one DELETE entry plus one CASCADE_CLOSE per **OPEN** account (skipping already-CLOSED ones), forwards `correlationId`/`actor`, audit trail outlives the deleted row. Also covers create defaults + list filters/sort/pagination (search, role, status, hasAccounts cross-aggregate) |

A `resetStore()` helper in `server/__tests__/helpers/` wipes the in-memory store between tests so each test runs against a clean database.

### Cypress end-to-end specs

| Spec | Flow covered |
|---|---|
| `cypress/e2e/employee-flow.cy.ts` | Listing, search, create + delete, required-field validation |
| `cypress/e2e/account-flow.cy.ts` | Account CRUD on the detail page: create with unique number, balance/format validation, close via confirm dialog, reopen back to OPEN |
| `cypress/e2e/audit-log-flow.cy.ts` | After actions (status toggle, account add/close/reopen) the matching entry appears at the **top** of the audit log with the right action label, masked account number, actor and cid |
| `cypress/e2e/employee-filters.cy.ts` | Each filter (search/role/status/hasAccounts) narrows the result; combinations compose with AND semantics; `with` and `without` partition the universe; reset clears all four; any filter change drops back to page 1 |

---

## 5. REST API

The mock backend exposes every HTTP method called out by the spec.

| Resource       | Verb     | URL                                  | Notes                                  |
|---------------|----------|--------------------------------------|----------------------------------------|
| Employees     | `GET`    | `/api/employees`                     | Search + filter + paginate + sort      |
|               | `GET`    | `/api/employees/:id`                 | Single employee                        |
|               | `GET`    | `/api/employees/email-available`     | Async validator helper                 |
|               | `POST`   | `/api/employees`                     | Create                                 |
|               | `PUT`    | `/api/employees/:id`                 | Full replace                           |
|               | `PATCH`  | `/api/employees/:id`                 | Partial update (e.g. status)           |
|               | `DELETE` | `/api/employees/:id`                 | Hard delete + cascade soft-close accts |
| Accounts      | `GET`    | `/api/employees/:id/accounts`        |                                        |
|               | `POST`   | `/api/employees/:id/accounts`        | Create account for employee            |
|               | `GET`    | `/api/accounts/:accountId`           | Single account                         |
|               | `PUT`    | `/api/accounts/:accountId`           | Full replace                           |
|               | `PATCH`  | `/api/accounts/:accountId`           | Partial update                         |
|               | `DELETE` | `/api/accounts/:accountId`           | **Soft close** (sets `status=CLOSED`)  |
| Audit         | `GET`    | `/api/employees/:id/audit`           | **Append-only** trail for the employee (profile + their accounts). Newest first, paginated via `?page=&size=`. |

Errors are returned as RFC 7807 *problem-details* documents:

```json
{
  "type": "about:blank#validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "One or more fields are invalid",
  "errors": [{ "field": "email", "message": "Valid email is required" }]
}
```

Every request/response carries an `X-Correlation-Id` header so client + server log lines can be tied together.

### Audit log (append-only)

Every meaningful write against an employee profile - or against one of their
accounts - is recorded as an immutable audit entry, attributed to the
operating actor and the request's `X-Correlation-Id`.

| Triggering action | Audit entry |
|---|---|
| Create employee | `Employee` / `CREATE` with full snapshot |
| Update or PATCH employee | `Employee` / `UPDATE` with field-level diff |
| Delete employee | `Employee` / `DELETE` with pre-delete snapshot + one `Account` / `CASCADE_CLOSE` per OPEN account on the way out |
| Create account | `Account` / `CREATE` with snapshot |
| Update / PATCH account | `Account` / `UPDATE` with field-level diff (or `CLOSE` / `REOPEN` for status-only flips) |
| Close account (DELETE) | `Account` / `CLOSE` |

Entries are append-only by design: the audit repository deliberately exposes
no update or delete operations, and entries persist even after the parent
employee is deleted. The frontend renders the trail on the **employee detail
page** with colour-coded action badges, before/after diffs and the cid
of each operation. Refresh button re-fetches on demand.

Endpoint: `GET /api/employees/:id/audit?page=&size=` (newest first).

---

## 6. Architecture

### Folder structure (server) - MVC + repository pattern

The Express backend follows a layered MVC structure, with the "model" tier
further split into a **repository** (pure CRUD) and a **service** (business
rules). Each layer has exactly one responsibility, which makes the codebase
easy to reason about and easy to test in isolation.

```
server/
├── server.js                      // entry point (binds to a port)
├── app.js                         // Express app factory (middleware + routes)
├── config/index.js                // PORT, header names, MAX_BALANCE
├── data/
│   ├── seed.js                    // seed fixtures (33 employees + 12 accounts)
│   └── store.js                   // single in-memory database singleton
├── repositories/                  // M (storage) - pure CRUD against the store
│   ├── employee.repository.js
│   └── account.repository.js
├── services/                      // M (domain) - business rules + orchestration
│   ├── employee.service.js
│   └── account.service.js
├── validators/                    // input validation (returns errors[])
│   ├── common.js
│   ├── employee.validator.js
│   └── account.validator.js
├── controllers/                   // C - req/res orchestration
│   ├── employee.controller.js
│   └── account.controller.js
├── routes/                        // URL -> controller wiring
│   ├── employee.routes.js
│   └── account.routes.js
├── middleware/                    // cross-cutting concerns
│   ├── correlation-id.js
│   ├── logger.js
│   └── error-handler.js
└── utils/                         // pure helpers
    ├── problem-details.js
    └── sanitize.js
```

#### Request flow

```
HTTP request
   |
   v
[middleware]   correlation-id  ->  logger
   |
   v
[routes]       /api/employees/:id  ->  controller.getById
   |
   v
[controller]   sanitize -> validate -> uniqueness check -> service call
   |
   v
[service]      apply business rules (defaults, timestamps, cascades)
   |
   v
[repository]   reads / mutates  data/store.js
   |
   v
[controller]   shapes HTTP response (status + body + headers)
   |
   v
HTTP response  (or [error-handler] -> problem-details JSON)
```

#### Layer responsibilities

| Layer | Owns | Does NOT do |
|---|---|---|
| **Repository** | Pure CRUD against the store, query helpers (`findByEmail`, `findByEmployeeId`, `getEmployeeIdsWithAccounts`) | Timestamps, uuids, defaults, HTTP, business rules |
| **Service** | Business rules (cascade soft-close on delete, soft close-only, "OPEN by default"), uuid + timestamp generation, list query (filters/sort/pagination, cross-aggregate joins) | Direct store access, HTTP |
| **Validator** | Schema checks, friendly error messages | DB access, HTTP responses |
| **Controller** | Input parsing/sanitising, validator + service orchestration, status codes | Business rules, route definitions, repository access |
| **Routes** | URL -> controller wiring, route order | Logic of any kind |
| **Middleware** | Cross-cutting (cid, logging, errors) | Resource-specific logic |

#### Why split model -> repository + service?

Two practical wins from the split:

1. **The store implementation becomes swappable.** When the in-memory store
   is eventually replaced with Postgres / Mongo / whatever, only the
   repository changes. Services, controllers, validators, routes - all
   untouched.
2. **Business rules become testable in isolation.** You can hand the
   service a stub repository and assert that "deleting an employee cascades
   a soft-close to every account they own" without spinning up the store
   at all.

The dependency direction is one-way:
`controller -> service -> repository -> store`.
A controller importing a repository (or a service touching the store) is
the architectural smell to watch for.

### Folder structure (client)

```
src/app/
├── app.component.* | app.config.ts | app.routes.ts     // App shell
├── core/                                              // Cross-cutting concerns
│   ├── models/         (Employee, Account, ApiError)
│   ├── services/       (HTTP clients, logger, notifications)
│   ├── interceptors/   (correlation-id, error normalisation)
│   ├── validators/     (async unique-email)
│   └── guards/         (unsaved-changes)
├── shared/                                            // Reusable UI library
│   ├── components/     (confirm-dialog, notification, spinner, empty-state, page-header)
│   └── pipes/          (maskAccount, money)
└── features/
    ├── employees/                                     // Lazy-loaded route
    │   ├── employees.routes.ts
    │   ├── pages/      (employee-list, employee-detail, employee-form)
    │   ├── components/ (employee-filter)
    │   └── store/      (actions, reducer, selectors, effects, facade)
    └── accounts/
        ├── components/ (account-list, account-form, account-summary)
        └── store/      (actions, reducer, selectors, effects, facade)
```

### NgRx structure

We use the **action-group + facade** pattern with `createFeature`:

- **Actions** are split by source: `EmployeePageActions` (UI intent) and `EmployeeApiActions` (effect outcomes). This keeps the dev-tools trace easy to read.
- **Reducer** is generated through `createFeature`, which exposes selectors for every field automatically. Composed selectors (`selectTotalPages`, `selectSubtotalsByCurrency`) live alongside the auto-generated ones.
- **Effects** are functional (`createEffect(... , { functional: true })`). Each side-effect (HTTP, navigation, toast) lives in its own small effect for readability and testability.
- **Facade** (`EmployeeFacade`, `AccountFacade`) gives components a stable interface so they never reach into the store directly. Components only ever inject the facade.
- **Router-store** is wired (`provideRouterStore()`), making router state observable through NgRx (bonus item from the spec).

### Signals at the leaf (the NgRx + Signals split)

NgRx remains the **single source of truth** for cross-component state. Signals show up at three specific seams where they are objectively the right tool — *not* sprinkled everywhere.

| Pattern | Where it's used | Why it's the right tool here |
|---|---|---|
| `toSignal()` bridge | `EmployeeListComponent`, `AccountListComponent`, `EmployeeDetailComponent` | Converts facade observables to signals at the component boundary. Templates read state synchronously (`items()`, `loading()`) instead of pipe-chaining (`(items$ \| async)`) and lose the `@if (...; as x)` workaround in the process. The store doesn't change. |
| `signal()` for component-local UI state | `confirmOpen`, `pendingDelete`, `pendingClose`, `showForm`, `editing`, `query` | These flags are never shared, never persisted, never queried by anything else. Putting them in NgRx would be a feature-slice for what is effectively a class field. Signals give granular updates without ceremony. |
| `computed()` for derived view-model | `pageSummary` in employee list, `formHeading` in account list, `hasNotifications` in notification service | Memoised derivations of multiple signals. The string `"3 / 7 - 65 total"` recomputes only when `page`, `totalPages` or `total` actually change. |
| `effect()` for side-effects | `document.title` sync in `EmployeeDetailComponent` | Classic state-driven DOM mutation outside Angular's render cycle. Building an NgRx action chain to write one string to the document would be theatre. `effect()` auto-tracks the `employee()` signal and tears itself down on component destroy via `DestroyRef`. |
| Signal-first service | `NotificationService` | The toast queue is pure UI plumbing — items live 3–5 seconds and then vanish. A `signal<Notification[]>()` plus a `computed()` (`hasNotifications`) is the right shape; an NgRx slice would be 4 files of boilerplate for the same job. |

Concretely, the boundary looks like:

```
NgRx store    ──── Observable streams ────►  EmployeeFacade
                                                  │
                                                  │  (facade keeps the Observable API)
                                                  ▼
                                            Component
                                                  │
                                                  │  toSignal(facade.items$)
                                                  ▼
                                            items: Signal<Employee[]>
                                                  │
                                                  ▼
                                            Template: {{ items() }}
```

The facade was deliberately left observable-based: it works equally well with the audit-log component (which doesn't use signals because it has no global state to bridge) and with the legacy CDK / RxJS-flavoured code paths. Components decide how they want to consume the streams.

### Parent / child relationship

The **employee detail page** (parent) renders the **account list** (child) and passes the employee id via `@Input`. The child owns the `accounts` NgRx slice (per-employee) and notifies the global toast surface via effects rather than via `@Output` - this keeps the parent decoupled from account mutation outcomes.

### HTTP interceptors

Two functional interceptors, registered in `app.config.ts`:

1. **`correlationIdInterceptor`** - attaches `X-Correlation-Id` per request (uses `crypto.randomUUID()` when available).
2. **`errorInterceptor`** - normalises `HttpErrorResponse` into our internal `ApiError` shape, preserves the correlation id, and logs through `LoggerService`. Errors flow through to the effect-level `catchError` so the store stays the source of truth for UI error state.

### Forms

Strongly-typed reactive forms (`fb.nonNullable.group`) with:

- `Validators.required`, `Validators.email`, `Validators.maxLength`, numeric `min` / `pattern`
- **Async unique-email** validator that calls `GET /api/employees/email-available` (debounced + de-duplicated; `excludeId` keeps edit mode sane)
- Form-level error summary that echoes server-side problem-details
- `CanDeactivate` guard for unsaved changes

### Styling

- One global SCSS file with design tokens (`:root` custom properties) and primitive utility/component classes (`.card`, `.btn`, `.table`, `.badge`)
- Component-scoped styles only where the global ones aren't enough
- Responsive: layout primitives collapse from 4-up to 2-up to 1-up at common tablet / mobile breakpoints

### Quality & security

- **Input sanitisation** on the server side (HTML tag stripping)
- **Validation** on both client and server (defence in depth)
- **Problem-details** error responses
- **Correlation-id** logging on both sides
- **`OnPush` change detection** everywhere

---

## 7. Bonus items delivered

- Sorting + pagination on the employee list
- Per-currency subtotals + total balance for accounts
- Router-store integration
- Cypress end-to-end spec for the employee CRUD flow
- **Append-only audit log per employee** (profile + their accounts), rendered on the detail page with action badges, field-level diffs, and correlation-id traceability

---

## 8. Notes for the reviewer

- Data lives in-memory; restarting the server reseeds. There is no production database wiring.
- The "total balance" tile sums numeric balances across currencies as a single number - a real product would FX-convert into a base currency; calling that out explicitly in the UI was the simplest honest choice for a take-home.
- The Cypress spec assumes both the dev server and the mock API are running (the standard `npm start` flow does that for you).
