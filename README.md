<div align="center">

# 🏦 Banking Admin Portal

**An internal back-office tool for managing employees and their linked banking accounts.**
Built as a take-home for a **Senior Angular Developer** role — and treated as a real product, not a spec speed-run.

![Angular](https://img.shields.io/badge/Angular-17-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![NgRx](https://img.shields.io/badge/NgRx-17-BA2BD2?logo=reduxsaga&logoColor=white)
![RxJS](https://img.shields.io/badge/RxJS-7-B7178C?logo=reactivex&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A520.11-339933?logo=node.js&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-tested-C21325?logo=jest&logoColor=white)
![Cypress](https://img.shields.io/badge/Cypress-e2e-69D3A7?logo=cypress&logoColor=white)

</div>

```
banking-admin-portal/
├── server/    # Express mock HTTP API  (in-memory, all REST verbs)
├── client/    # Angular 17 standalone app  (NgRx + Signals, Cypress)
└── docs/      # Architectural deep-dives + interview prep
```

> 🧑‍⚖️ **Reviewing this as an interviewer?** The [`docs/`](./docs/) folder is the full decision log — the NgRx + Signals split, the MVC + repository pattern, an accessibility audit, the page-size DoS-hardening rationale, and a candid self-review of the gaps that remain. The curated index is in [§7 Further reading](#7-further-reading); the two-minute architecture story lives in [docs/INTERVIEW_PLAYBOOK.md](./docs/INTERVIEW_PLAYBOOK.md).

---

## ⚡ Quick start

```bash
npm run install:all   # once — installs root, server, and client deps
npm start             # runs API + Angular together
```

| Service | URL | Notes |
| ------- | --- | ----- |
| 🅰️ Angular dev server | <http://localhost:4200> | Open this. Proxies `/api/*` → mock API. |
| 🔌 Express mock API | <http://localhost:3000> | Seeded with **33 employees + 12 accounts** on every restart. |

Full prerequisites in [§1](#1-prerequisites); per-side and test commands in [§3](#3-run-the-app)–[§4](#4-run-the-tests).

---

## ✨ At a glance

| | |
| --- | --- |
| **Frontend** | Angular 17 standalone components, **NgRx** (action-group + facade), **Signals** at the leaf, reactive forms with an async unique-email validator, two HTTP interceptors, lazy-loaded feature routes, `OnPush` everywhere. |
| **Backend** | Express with a strict **MVC + service + repository** stack, RFC 7807 problem-details errors, input sanitisation, correlation-id tracing, an **append-only audit log**. |
| **All 5 HTTP verbs** | `GET` · `POST` · `PUT` · `PATCH` · `DELETE` across employees and accounts. |
| **Tested** | 4 frontend unit specs · 2 backend Jest suites · 4 Cypress e2e flows. |
| **Responsive** | Phone → tablet → desktop → 4K, one breakpoint system. |
| **Bonus items** | Sort + pagination, per-currency subtotals, router-store, append-only audit log. |

---

## 📑 Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Install dependencies](#2-install-dependencies)
3. [Run the app](#3-run-the-app)
4. [Run the tests](#4-run-the-tests)
5. [REST API](#5-rest-api)
6. [Architecture](#6-architecture)
7. [Further reading](#7-further-reading)
8. [Bonus items delivered](#8-bonus-items-delivered)
9. [Notes for the reviewer](#9-notes-for-the-reviewer)
10. [Senior-dev review: what's missing](#10-senior-dev-review-whats-missing)

---

## 1. Prerequisites

| Tool        | Version        | Notes                                                                                                                         |
| ----------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Node.js** | `>= 20.11 LTS` | Required by Angular 17 toolchain. Node 22 LTS is also supported. Node 18 reached EOL in April 2025 and is no longer accepted. |
| **npm**     | `>= 10`        | Bundled with Node 20.                                                                                                         |
| **Chrome**  | latest         | Karma tests use `ChromeHeadless`.                                                                                             |
| **Git**     | any recent     | For cloning / commits.                                                                                                        |

> Pinned via `engines` in each `package.json`. `npm install` will warn if you're on an older Node. Tested on Node 20.x and 22.x.

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

| Service            | URL                     | Notes                                                     |
| ------------------ | ----------------------- | --------------------------------------------------------- |
| Express mock API   | <http://localhost:3000> | Seeded with 33 employees + 12 accounts on every restart.  |
| Angular dev server | <http://localhost:4200> | Proxies `/api/*` to the mock API (see `proxy.conf.json`). |

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

| Layer     | File                                                            |
| --------- | --------------------------------------------------------------- |
| Reducer   | `employees/store/employee.reducer.spec.ts`                      |
| Effect    | `employees/store/employee.effects.spec.ts`                      |
| Service   | `core/services/employee-api.service.spec.ts`                    |
| Form (UI) | `employees/pages/employee-form/employee-form.component.spec.ts` |

### Backend unit tests (Jest)

The two highest-risk service files are covered end to end:

| File                                                 | What's covered                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/__tests__/services/audit.service.test.js`    | **Diff computation** (no-op writes return `null`, single/multi field diffs, untracked fields ignored), CREATE/DELETE snapshot shape, CLOSE/REOPEN/CASCADE_CLOSE narratives, context defaults (`actor=admin`, `correlationId=null`), `listForEmployee` ordering + pagination                                                                                                                                                 |
| `server/__tests__/services/employee.service.test.js` | **Remove cascade rules** - `remove()` returns false for unknown ids, deletes the employee, flips OPEN accounts to CLOSED, emits exactly one DELETE entry plus one CASCADE_CLOSE per **OPEN** account (skipping already-CLOSED ones), forwards `correlationId`/`actor`, audit trail outlives the deleted row. Also covers create defaults + list filters/sort/pagination (search, role, status, hasAccounts cross-aggregate) |

A `resetStore()` helper in `server/__tests__/helpers/` wipes the in-memory store between tests so each test runs against a clean database.

### Cypress end-to-end specs

| Spec                                 | Flow covered                                                                                                                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cypress/e2e/employee-flow.cy.ts`    | Listing, search, create + delete, required-field validation                                                                                                                                                          |
| `cypress/e2e/account-flow.cy.ts`     | Account CRUD on the detail page: create with unique number, balance/format validation, close via confirm dialog, reopen back to OPEN                                                                                 |
| `cypress/e2e/audit-log-flow.cy.ts`   | After actions (status toggle, account add/close/reopen) the matching entry appears at the **top** of the audit log with the right action label, masked account number, actor and cid                                 |
| `cypress/e2e/employee-filters.cy.ts` | Each filter (search/role/status/hasAccounts) narrows the result; combinations compose with AND semantics; `with` and `without` partition the universe; reset clears all four; any filter change drops back to page 1 |

---

## 5. REST API

The mock backend exposes every HTTP method called out by the spec.

| Resource  | Verb     | URL                              | Notes                                                                                                          |
| --------- | -------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Employees | `GET`    | `/api/employees`                 | Search + filter + paginate + sort                                                                              |
|           | `GET`    | `/api/employees/:id`             | Single employee                                                                                                |
|           | `GET`    | `/api/employees/email-available` | Async validator helper                                                                                         |
|           | `POST`   | `/api/employees`                 | Create                                                                                                         |
|           | `PUT`    | `/api/employees/:id`             | Full replace                                                                                                   |
|           | `PATCH`  | `/api/employees/:id`             | Partial update (e.g. status)                                                                                   |
|           | `DELETE` | `/api/employees/:id`             | Hard delete + cascade soft-close accts                                                                         |
| Accounts  | `GET`    | `/api/employees/:id/accounts`    |                                                                                                                |
|           | `POST`   | `/api/employees/:id/accounts`    | Create account for employee                                                                                    |
|           | `GET`    | `/api/accounts/:accountId`       | Single account                                                                                                 |
|           | `PUT`    | `/api/accounts/:accountId`       | Full replace                                                                                                   |
|           | `PATCH`  | `/api/accounts/:accountId`       | Partial update                                                                                                 |
|           | `DELETE` | `/api/accounts/:accountId`       | **Soft close** (sets `status=CLOSED`)                                                                          |
| Audit     | `GET`    | `/api/employees/:id/audit`       | **Append-only** trail for the employee (profile + their accounts). Newest first, paginated via `?page=&size=`. |

> 💡 A ready-to-import **Postman collection** covering every endpoint (with auto-saved ids and a correlation-id header) lives in [`postman/`](./postman/).

Errors are returned as RFC 7807 _problem-details_ documents:

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

| Triggering action        | Audit entry                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Create employee          | `Employee` / `CREATE` with full snapshot                                                                         |
| Update or PATCH employee | `Employee` / `UPDATE` with field-level diff                                                                      |
| Delete employee          | `Employee` / `DELETE` with pre-delete snapshot + one `Account` / `CASCADE_CLOSE` per OPEN account on the way out |
| Create account           | `Account` / `CREATE` with snapshot                                                                               |
| Update / PATCH account   | `Account` / `UPDATE` with field-level diff (or `CLOSE` / `REOPEN` for status-only flips)                         |
| Close account (DELETE)   | `Account` / `CLOSE`                                                                                              |

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

| Layer          | Owns                                                                                                                                                                        | Does NOT do                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Repository** | Pure CRUD against the store, query helpers (`findByEmail`, `findByEmployeeId`, `getEmployeeIdsWithAccounts`)                                                                | Timestamps, uuids, defaults, HTTP, business rules    |
| **Service**    | Business rules (cascade soft-close on delete, soft close-only, "OPEN by default"), uuid + timestamp generation, list query (filters/sort/pagination, cross-aggregate joins) | Direct store access, HTTP                            |
| **Validator**  | Schema checks, friendly error messages                                                                                                                                      | DB access, HTTP responses                            |
| **Controller** | Input parsing/sanitising, validator + service orchestration, status codes                                                                                                   | Business rules, route definitions, repository access |
| **Routes**     | URL -> controller wiring, route order                                                                                                                                       | Logic of any kind                                    |
| **Middleware** | Cross-cutting (cid, logging, errors)                                                                                                                                        | Resource-specific logic                              |

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

NgRx remains the **single source of truth** for cross-component state. Signals show up at three specific seams where they are objectively the right tool — _not_ sprinkled everywhere.

| Pattern                                 | Where it's used                                                                                           | Why it's the right tool here                                                                                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toSignal()` bridge                     | `EmployeeListComponent`, `AccountListComponent`, `EmployeeDetailComponent`                                | Converts facade observables to signals at the component boundary. Templates read state synchronously (`items()`, `loading()`) instead of pipe-chaining (`(items$ \| async)`) and lose the `@if (...; as x)` workaround in the process. The store doesn't change.  |
| `signal()` for component-local UI state | `confirmOpen`, `pendingDelete`, `pendingClose`, `showForm`, `editing`, `query`                            | These flags are never shared, never persisted, never queried by anything else. Putting them in NgRx would be a feature-slice for what is effectively a class field. Signals give granular updates without ceremony.                                               |
| `computed()` for derived view-model     | `pageSummary` in employee list, `formHeading` in account list, `hasNotifications` in notification service | Memoised derivations of multiple signals. The string `"3 / 7 - 65 total"` recomputes only when `page`, `totalPages` or `total` actually change.                                                                                                                   |
| `effect()` for side-effects             | `document.title` sync in `EmployeeDetailComponent`                                                        | Classic state-driven DOM mutation outside Angular's render cycle. Building an NgRx action chain to write one string to the document would be theatre. `effect()` auto-tracks the `employee()` signal and tears itself down on component destroy via `DestroyRef`. |
| Signal-first service                    | `NotificationService`                                                                                     | The toast queue is pure UI plumbing — items live 3–5 seconds and then vanish. A `signal<Notification[]>()` plus a `computed()` (`hasNotifications`) is the right shape; an NgRx slice would be 4 files of boilerplate for the same job.                           |

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

## 7. Further reading

The `docs/` folder contains architectural deep-dives written as the design decisions were made. Each explains the *why* a junior dev would need without skipping the depth a senior reviewer wants — they stand alone, read in any order.

<!-- Links are relative to the repo root: this README lives at the root, the docs live under docs/. -->

### 🏛️ Architecture & design

| Doc | What it covers |
|---|---|
| [docs/NGRX_GUIDE.md](./docs/NGRX_GUIDE.md) | How NgRx is layered here — Actions / Reducers / Selectors / Effects / Facades — with the full lifecycle traced for the delete action. |
| [docs/ARCHITECTURE_FUNDAMENTALS.md](./docs/ARCHITECTURE_FUNDAMENTALS.md) | The architecture + parent/child requirements: standalone structure, two-level lazy loading, the shared component library, and the `@Input`/`@Output` + facade split. |
| [docs/ANGULAR_FUNDAMENTALS_GUIDE.md](./docs/ANGULAR_FUNDAMENTALS_GUIDE.md) | The same fundamentals plus Forms and HTTP, explained for a junior dev. |
| [docs/CHANGE_DETECTION_GUIDE.md](./docs/CHANGE_DETECTION_GUIDE.md) | Why this app is Zone.js-based (not zoneless), and what that means. |
| [docs/WORKFLOW_DIAGRAMS.md](./docs/WORKFLOW_DIAGRAMS.md) | **Visual reference** — every layer and flow as a Mermaid diagram (system, frontend layering, backend stack, request lifecycle, six user-flow sequences, the correlation-id / error / validation / audit pipelines, an ER-style data model). Also a styled [HTML](./docs/WORKFLOW_DIAGRAMS.html) and print-ready [PDF](./docs/WORKFLOW_DIAGRAMS.pdf) — rebuild steps below. |

### 🛡️ Quality, security & decisions

| Doc | What it covers |
|---|---|
| [docs/MAX_PAGE_SIZE_CLAMP.md](./docs/MAX_PAGE_SIZE_CLAMP.md) | Why list endpoints clamp `?size=N` at 100, why clamp instead of reject, and the four-test pattern that proves it. |
| [docs/ACCESSIBILITY_AUDIT.md](./docs/ACCESSIBILITY_AUDIT.md) | Six WAI-ARIA improvements with before/after code and what each announces to a screen reader. WCAG 2.1 mapping included. |
| [docs/PII_LOGGING_TRADEOFF.md](./docs/PII_LOGGING_TRADEOFF.md) | Why logging full models is a demo-only choice and how it'd be gated behind `LOG_LEVEL=debug` in production. |
| [docs/CORS_SECURITY_FIX.md](./docs/CORS_SECURITY_FIX.md) · [docs/EMAIL_AVAILABILITY_INVESTIGATION.md](./docs/EMAIL_AVAILABILITY_INVESTIGATION.md) | Targeted investigations: CORS posture, and the "is the email-available endpoint wrong?" reproduce-don't-guess writeup. |
| [docs/CYPRESS_TEST_TARGET_DECISION.md](./docs/CYPRESS_TEST_TARGET_DECISION.md) · [docs/TEST_BREADTH_GUIDE.md](./docs/TEST_BREADTH_GUIDE.md) · [docs/CI_PIPELINE_GUIDE.md](./docs/CI_PIPELINE_GUIDE.md) | Test-target choice (dev server vs CI), test-breadth strategy, and CI pipeline notes. |
| [docs/ASSIGNMENT_COMPLIANCE_AUDIT.md](./docs/ASSIGNMENT_COMPLIANCE_AUDIT.md) | A section-by-section check of the project against the full assignment spec — what's present (how) and what's thin (why). |

### 🎤 Interview prep

| Doc | What it covers |
|---|---|
| [docs/INTERVIEW_PLAYBOOK.md](./docs/INTERVIEW_PLAYBOOK.md) | The full ten-step prep: two-minute pitch, ASCII architecture diagram, decision tree with rejected alternatives, honest impact numbers, what didn't work, and a day-before checklist. |
| [docs/INTERVIEW_PREP.md](./docs/INTERVIEW_PREP.md) | The **delivery** guide: how to record a demo video, the diagrams to show, the hero code snippets, and a minute-by-minute live-demo script. |
| [docs/INTERVIEW_PREP_WITH_JAVA_ALT.md](./docs/INTERVIEW_PREP_WITH_JAVA_ALT.md) | Every backend concept mapped to its Java / Spring Boot equivalent (Bean Validation, `ProblemDetail`, JPA, Envers, MDC…). |
| [docs/HOW_WOULD_YOU_SCALE_THIS_10X.md](./docs/HOW_WOULD_YOU_SCALE_THIS_10X.md) | The scaling answer in depth: Postgres + indexes, event sourcing + Redis, stateless horizontal scale, OpenTelemetry off the correlation-id. |
| [docs/INTERVIEW_REFLECTION.md](./docs/INTERVIEW_REFLECTION.md) | The five-question pre-interview exercise drilled down to speakable answers. |
| [docs/PROJECT_DEEP_ANALYSIS.md](./docs/PROJECT_DEEP_ANALYSIS.md) | A full audit through a banking-industry interviewer's eyes — eight evaluation lenses, gaps ranked by blast radius, a six-month roadmap, and a calibrated 3.4/5 self-rating. |

<details>
<summary><strong>🖨️ Regenerating the WORKFLOW_DIAGRAMS PDF</strong></summary>

The PDF in `docs/WORKFLOW_DIAGRAMS.pdf` was generated by running the styled `WORKFLOW_DIAGRAMS.html` through headless Chrome / Edge. After you edit the HTML, regenerate the PDF with:

**Windows (PowerShell)** — uses Edge, which ships with Windows:

```powershell
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$html = "$PWD\docs\WORKFLOW_DIAGRAMS.html"
$pdf  = "$PWD\docs\WORKFLOW_DIAGRAMS.pdf"
$url  = "file:///" + ($html -replace '\\', '/' -replace ' ', '%20')
& $edge --headless=new --disable-gpu --virtual-time-budget=15000 `
        --run-all-compositor-stages-before-draw --no-pdf-header-footer `
        "--print-to-pdf=$pdf" $url
```

**macOS / Linux** — uses Chrome:

```bash
chrome \
  --headless=new --disable-gpu --virtual-time-budget=15000 \
  --run-all-compositor-stages-before-draw --no-pdf-header-footer \
  --print-to-pdf="$PWD/docs/WORKFLOW_DIAGRAMS.pdf" \
  "file://$PWD/docs/WORKFLOW_DIAGRAMS.html"
```

The `--virtual-time-budget=15000` flag is what makes this work — it gives the browser 15 seconds of "virtual time" so the embedded Mermaid script can finish rendering all 12 diagrams before the page snapshots to PDF. Without it, you get a PDF of the unrendered Mermaid source.

**Alternative for non-developers**: open `WORKFLOW_DIAGRAMS.html` in any browser, wait for the diagrams to render (~3 seconds), then `Ctrl+P` → "Save as PDF" → choose A4 portrait. Identical output, no command line.

</details>

---

## 8. Bonus items delivered

- ✅ Sorting + pagination on the employee list
- ✅ Per-currency subtotals + total balance for accounts
- ✅ Router-store integration
- ✅ Cypress end-to-end spec for the employee CRUD flow
- ✅ **Append-only audit log per employee** (profile + their accounts), rendered on the detail page with action badges, field-level diffs, and correlation-id traceability

---

## 9. Notes for the reviewer

- Data lives in-memory; restarting the server reseeds. There is no production database wiring.
- The "total balance" tile sums numeric balances across currencies as a single number - a real product would FX-convert into a base currency; calling that out explicitly in the UI was the simplest honest choice for a take-home.
- The Cypress spec assumes both the dev server and the mock API are running (the standard `npm start` flow does that for you).
- **Logging note:** The mock services log full entity models to stdout on each write to make the demo easy to trace. In production this would be gated behind `LOG_LEVEL=debug` (or field-redacted), since employee email and account balance are PII and application logs are typically centralized and long-retained.

---

## 10. Senior-dev review: what's missing

A self-review of the gaps I'd flag in my own PR. Listed in roughly the order I'd prioritise fixing them on a real team.

### 🔴 Critical (would block production)

1. **No authentication.** Every audit entry records `actor: 'admin'` because there's no user concept. JWT middleware populating `req.user` is the unblock for everything below.
2. **No backend test coverage on validators / controllers / middleware.** Jest currently covers the two highest-risk services (audit + employee). The validators and controllers are tested transitively via Cypress but have no direct unit tests — a regression in a validator wouldn't fail in CI until the e2e suite ran.
3. **Validation rules duplicated client and server.** The name regex `/^\p{L}[\p{L} \-']*$/u`, `MAX_BALANCE`, and the account-number pattern appear in both `client/src/app/core/validators/` and `server/validators/common.js`. A one-sided edit would mean silent contract drift. Fix is a shared package both depend on.

### 🟡 Should fix (visible in PR review)

4. **`prefers-reduced-motion` not respected** on the toast slide-in animation and the confirm-dialog fade.
5. **No CI pipeline** — `.github/workflows/ci.yml` would run lint + frontend tests + backend Jest + build on every PR.
6. **No rate limiting** on the Express endpoints. `MAX_PAGE_SIZE` caps one request; nothing stops 10 000 of them per second.
7. **Request body size not capped** explicitly. Express defaults are reasonable for this project but defence in depth would set `express.json({ limit: '32kb' })`.
8. **The confirm dialog rolls its own focus management** rather than using `@angular/cdk/dialog`. The hand-rolled version is correct (and educational) but the CDK is what a real shared component library would standardise on.
9. **No formal contrast audit.** Visual inspection passes; the TD-green palette is conservative; an axe-core paid scan would prove it.

<details>
<summary><strong>🟢 Nice to have (genuine backlog)</strong></summary>

10. **State persistence across refresh.** Filters and pagination reset to defaults on page reload — sync to URL query params via `router.navigate(..., { queryParams: ..., queryParamsHandling: 'merge' })` and the router-store integration starts paying for itself.
11. **No optimistic updates.** Status toggle on the detail page waits for the API round-trip before the badge flips. A `patchStatus` reducer-side optimistic flip with rollback on `*Failure` would be ~15 lines and feel snappier.
12. **Audit log frontend doesn't paginate.** The endpoint supports it; the component always requests `size=50` and never advances. Above 50 entries on a single employee, older history silently isn't shown.
13. **No request timeouts** on the HTTP client. A hung backend pends the spinner forever. `timeout(15_000)` in the error interceptor would close that gap.
14. **Storybook absent.** Building a new shared component means launching the whole app. For a real product, Storybook would let `confirm-dialog`, `page-header`, etc. be developed in isolation.

</details>

### ⭐ Five things I'd actually fix first (if I had a week)

1. CI pipeline — stops new regressions immediately
2. Validator + controller Jest tests — fills the highest test-coverage gap
3. Auth scaffolding — unblocks everything audit-related
4. Shared validation package — fixes the drift risk before it bites
5. URL state persistence — turns sticky filters from a UX nice-to-have into the first real use of the existing `provideRouterStore()` registration

Everything else is genuine backlog material that would be prioritised against user feedback in a real product.

---

<div align="center">

**Built by Piyush Garg** · Angular 17 · NgRx · Express · Cypress
_Take-home for a Senior Angular Developer role — see [`docs/`](./docs/) for the full decision log._

</div>
