# Workflow & architecture diagrams — Banking Admin Portal

**The whole project, drawn out.** System architecture, layered structure on both sides, request lifecycle, every key user flow, the audit-recording pipeline, the validation chain, and the data model — all as renderable Mermaid diagrams plus ASCII fallbacks where they help.

GitHub, GitLab, VS Code's Markdown preview, and most modern Markdown renderers display the Mermaid blocks below natively. Open this file on GitHub for the best view.

---

## Table of contents

1. [How to read this document](#1-how-to-read-this-document)
2. [System architecture — the 10 000-ft view](#2-system-architecture--the-10-000-ft-view)
3. [Frontend layering](#3-frontend-layering)
4. [Backend layering (MVC + repository + service)](#4-backend-layering-mvc--repository--service)
5. [Request / response lifecycle (end to end)](#5-request--response-lifecycle-end-to-end)
6. [User flow workflows](#6-user-flow-workflows)
   - 6a. [Creating an employee](#6a-creating-an-employee)
   - 6b. [Toggling employee status (PATCH)](#6b-toggling-employee-status-patch)
   - 6c. [Deleting an employee with cascade soft-close](#6c-deleting-an-employee-with-cascade-soft-close)
   - 6d. [Adding an account](#6d-adding-an-account)
   - 6e. [Closing and reopening an account](#6e-closing-and-reopening-an-account)
   - 6f. [Viewing the audit log](#6f-viewing-the-audit-log)
7. [State management flow — NgRx + Signals split](#7-state-management-flow--ngrx--signals-split)
8. [Cross-cutting concerns](#8-cross-cutting-concerns)
   - 8a. [Correlation-id end-to-end](#8a-correlation-id-end-to-end)
   - 8b. [Error normalisation pipeline](#8b-error-normalisation-pipeline)
   - 8c. [Validation chain (client + server)](#8c-validation-chain-client--server)
   - 8d. [Audit recording pipeline](#8d-audit-recording-pipeline)
9. [Data model — entity relationships](#9-data-model--entity-relationships)
10. [Audit log entry shape per action](#10-audit-log-entry-shape-per-action)
11. [Dev environment orchestration](#11-dev-environment-orchestration)
12. [Testing pipeline](#12-testing-pipeline)

---

## 1. How to read this document

Three diagram kinds appear below, each chosen for what it shows best:

| Kind | When used | What it shows |
|---|---|---|
| **`graph` / `flowchart`** | Architecture, layering | Static relationships — boxes and arrows |
| **`sequenceDiagram`** | Workflows, user flows | Time-ordered interactions across processes |
| **`erDiagram` / `classDiagram`** | Data model | Entity shape + cardinality |

Each section pairs a Mermaid block (the canonical version) with one or two sentences telling you what to look at. The narrative captions are deliberately short; the diagrams are the point.

---

## 2. System architecture — the 10 000-ft view

The whole stack on one page. Two processes, one proxy, one in-memory store.

```mermaid
graph TB
    Browser["🖥️ Browser<br/>(any modern, ≥ 360px)"]

    subgraph Client["Angular dev server :4200"]
        AngularApp["Angular 17 SPA<br/>Standalone components<br/>NgRx + Signals"]
        Proxy["proxy.conf.json<br/>/api/* → :3000"]
    end

    subgraph Server["Express mock API :3000"]
        ExpressApp["Express app<br/>MVC + Repository + Service"]
        Store[("In-memory store<br/>employees · accounts · auditLog")]
    end

    Browser -->|HTTPS| AngularApp
    AngularApp -->|fetch /api/...| Proxy
    Proxy -->|HTTP| ExpressApp
    ExpressApp -->|read / write| Store

    style Browser fill:#E8F5E8,stroke:#008A00
    style Client fill:#EEF2FF,stroke:#1f4ed8
    style Server fill:#FFF6DA,stroke:#B45309
    style Store fill:#FBE7EB,stroke:#C7102E
```

**What to notice.** Everything is local. No databases, no cloud services, no auth provider. The proxy is what avoids CORS in development — production would terminate at a reverse proxy (nginx, ALB, etc.) instead.

---

## 3. Frontend layering

Angular standalone components consume the NgRx store through per-feature facades. Signals appear at the leaf via `toSignal()`. Two HTTP interceptors sit between the services and the network.

```mermaid
graph TB
    subgraph View["View layer (templates + components)"]
        Templates["Component templates<br/>@if / @for / @let"]
        Components["Standalone components<br/>OnPush change detection<br/>signal() · computed() · effect()"]
    end

    subgraph Facade["Facade layer (interface)"]
        EmployeeFacade["EmployeeFacade<br/>(Observable surface)"]
        AccountFacade["AccountFacade"]
        AuditService["AuditApiService<br/>(simple HTTP wrapper)"]
    end

    subgraph Store["NgRx store"]
        Actions["Actions<br/>createActionGroup()"]
        Reducers["Reducers<br/>createFeature()"]
        Selectors["Selectors<br/>(memoised)"]
        Effects["Effects<br/>(functional, HTTP)"]
    end

    subgraph HTTP["HTTP layer"]
        CorrelationInterceptor["correlation-id interceptor<br/>(attach X-Correlation-Id)"]
        ErrorInterceptor["error interceptor<br/>(normalise to ApiError)"]
        ApiServices["EmployeeApiService<br/>AccountApiService"]
    end

    Components -->|read state| Facade
    Components -->|read via toSignal()| Facade
    Components -->|dispatch via facade| Facade

    EmployeeFacade --> Actions
    AccountFacade --> Actions
    EmployeeFacade -->|select| Selectors

    Actions --> Reducers
    Actions --> Effects
    Effects --> Selectors
    Effects --> ApiServices

    AuditService --> ApiServices

    ApiServices --> CorrelationInterceptor
    CorrelationInterceptor --> ErrorInterceptor
    ErrorInterceptor -.->|HTTP| Backend(("/api/* to Express"))

    Templates --- Components

    style View fill:#E8F5E8,stroke:#008A00
    style Facade fill:#EEF2FF,stroke:#1f4ed8
    style Store fill:#FFF6DA,stroke:#B45309
    style HTTP fill:#FBE7EB,stroke:#C7102E
```

**What to notice.** Components never import from `Store` directly — they go through a facade. The facade still exposes Observables (`items$`, `loading$`); components decide whether to consume them as observables or bridge them to signals via `toSignal()`. The audit log is a special case — it bypasses NgRx entirely because it's read-only and only displayed in one place.

---

## 4. Backend layering (MVC + repository + service)

Each layer has exactly one job. The arrow direction is the *call* direction — nothing ever calls upward.

```mermaid
graph TB
    HTTP["HTTP request"]

    subgraph Middleware["Middleware (cross-cutting)"]
        Cid["correlation-id<br/>(echo or mint)"]
        Logger["morgan logger<br/>(with cid)"]
        ErrHandler["error handler<br/>(problem-details)"]
    end

    subgraph Routes["Routes (URL → handler)"]
        EmployeeRoutes["employee.routes.js"]
        AccountRoutes["account.routes.js"]
        AuditRoutes["audit.routes.js"]
    end

    subgraph Controllers["Controllers (HTTP shape)"]
        EmployeeController["employee.controller.js<br/>(sanitise + dispatch)"]
        AccountController["account.controller.js"]
        AuditController["audit.controller.js"]
    end

    subgraph Validators["Validators (pure functions)"]
        CommonV["common.js<br/>(name, email, balance)"]
        EmployeeV["employee.validator.js"]
        AccountV["account.validator.js"]
    end

    subgraph Services["Services (business rules)"]
        EmployeeSvc["employee.service.js<br/>uuid + timestamps<br/>cascade soft-close<br/>list query"]
        AccountSvc["account.service.js<br/>soft-close on DELETE<br/>named-action narratives"]
        AuditSvc["audit.service.js<br/>diff computation<br/>record* methods"]
    end

    subgraph Repos["Repositories (pure CRUD)"]
        EmployeeRepo["employee.repository.js"]
        AccountRepo["account.repository.js"]
        AuditRepo["audit.repository.js<br/>(append-only)"]
    end

    Store[("data/store.js<br/>employees · accounts · auditLog")]

    HTTP --> Cid --> Logger
    Logger --> Routes
    Routes --> Controllers

    EmployeeController --> EmployeeV
    AccountController --> AccountV
    EmployeeV --> CommonV
    AccountV --> CommonV

    EmployeeController --> EmployeeSvc
    AccountController --> AccountSvc
    AccountController --> EmployeeSvc
    AuditController --> AuditSvc

    EmployeeSvc --> EmployeeRepo
    EmployeeSvc --> AccountRepo
    EmployeeSvc --> AuditSvc
    AccountSvc --> AccountRepo
    AccountSvc --> AuditSvc
    AuditSvc --> AuditRepo

    EmployeeRepo --> Store
    AccountRepo --> Store
    AuditRepo --> Store

    Controllers -.->|500 etc| ErrHandler

    style Middleware fill:#EEF2FF,stroke:#1f4ed8
    style Routes fill:#FFF6DA,stroke:#B45309
    style Controllers fill:#E8F5E8,stroke:#008A00
    style Validators fill:#FFF6DA,stroke:#B45309
    style Services fill:#E8F5E8,stroke:#008A00
    style Repos fill:#FBE7EB,stroke:#C7102E
    style Store fill:#EEF2FF,stroke:#1f4ed8
```

**The unbreakable rule.** A controller importing a repository, or a service touching `data/store.js` directly, is the architectural smell. None of them do.

---

## 5. Request / response lifecycle (end to end)

A single `POST /api/employees` request, traced through every box that touches it. Same pattern applies to PUT, PATCH, DELETE — only the verb and the service method change.

```mermaid
sequenceDiagram
    participant User as 👤 Admin
    participant View as Form component
    participant Facade as EmployeeFacade
    participant Store as NgRx store
    participant Effect as createEmployee$ effect
    participant API as EmployeeApiService
    participant CidI as correlation-id interceptor
    participant ErrI as error interceptor
    participant Express as Express
    participant Ctrl as EmployeeController
    participant Val as employee.validator
    participant Svc as EmployeeService
    participant Repo as EmployeeRepository
    participant Audit as AuditService
    participant Stored as data/store

    User->>View: submit form
    View->>Facade: facade.create(payload)
    Facade->>Store: dispatch EmployeePageActions.create
    Store->>Effect: action observed
    Effect->>API: api.create(payload)
    API->>CidI: HTTP POST /api/employees
    CidI->>CidI: attach X-Correlation-Id
    CidI->>ErrI: forward
    ErrI->>Express: request leaves browser

    Express->>Ctrl: route to controller.create
    Ctrl->>Val: validateCreate(body)
    Val-->>Ctrl: errors[] (empty if OK)
    Ctrl->>Svc: EmployeeService.create(payload, ctx)
    Svc->>Repo: insert(employee)
    Repo->>Stored: store.employees.push(...)
    Svc->>Audit: recordEmployeeCreated(employee, ctx)
    Audit->>Stored: store.auditLog.push(entry)
    Svc-->>Ctrl: return employee
    Ctrl-->>Express: 201 + employee JSON
    Express-->>ErrI: response (echoes X-Correlation-Id)
    ErrI-->>API: pass-through (no error)
    API-->>Effect: { employee }
    Effect->>Store: dispatch EmployeeApiActions.createSuccess
    Store->>Store: reducer prepends to items[], saving: false
    Store-->>Facade: items$ emits new array
    Facade-->>View: items() signal updates
    View-->>User: redirected to detail page<br/>via createSuccessNavigation$ effect

    Note over View,Stored: Total layers touched: 13<br/>Each one has a single responsibility
```

**What this proves.** The single source of truth is the store. The view never holds a copy of the employee — it reads through the facade, which reads the store. If we swap the in-memory store for Postgres tomorrow, the only file that changes is the repository.

---

## 6. User flow workflows

Each subsection shows the **happy path** for one user action. Failure paths (validation rejection, 404, 409 conflict) are similar but exit at the validator or service layer.

### 6a. Creating an employee

```mermaid
sequenceDiagram
    actor Admin
    participant List as Employee list page
    participant Form as Employee form page
    participant Facade as EmployeeFacade
    participant API as POST /api/employees
    participant Service as EmployeeService
    participant Audit as AuditService

    Admin->>List: click "+ New Employee"
    List->>Form: navigate /employees/new
    Form->>Form: render reactive form<br/>(required, email format,<br/>async unique email)
    Admin->>Form: fill fields
    Admin->>Form: tab off email
    Form->>API: GET /email-available?email=...
    API-->>Form: { available: true }
    Form->>Form: clear async validator
    Admin->>Form: click "Create employee"
    Form->>Facade: facade.create(payload)
    Facade->>API: POST /api/employees
    API->>Service: service.create(payload, ctx)
    Service->>Service: uuid + status: 'ACTIVE' + timestamps
    Service->>Audit: record CREATE entry
    Service-->>API: 201 + new employee
    API-->>Facade: createSuccess action
    Facade->>Form: success effect runs
    Form->>List: navigate to /employees/:id
    List->>Admin: toast "Employee X created"
```

### 6b. Toggling employee status (PATCH)

The "Mark INACTIVE" / "Mark ACTIVE" button on the detail page issues a partial update — just the `status` field.

```mermaid
sequenceDiagram
    actor Admin
    participant Detail as Employee detail page
    participant Facade as EmployeeFacade
    participant API as PATCH /api/employees/:id
    participant Service as EmployeeService
    participant Audit as AuditService

    Admin->>Detail: click "Mark INACTIVE"
    Detail->>Facade: facade.patchStatus(id, 'INACTIVE')
    Facade->>API: PATCH { status: 'INACTIVE' }
    API->>Service: service.patch(id, { status: 'INACTIVE' }, ctx)
    Service->>Service: snapshot before<br/>repository.update(...)<br/>snapshot after
    Service->>Audit: recordEmployeeUpdated(before, after)
    Note right of Audit: Diff: [{ field: 'status',<br/>before: 'ACTIVE',<br/>after: 'INACTIVE' }]
    Service-->>API: 200 + updated employee
    API-->>Facade: patchStatusSuccess action
    Facade->>Detail: badge re-renders<br/>document.title via effect()
    Detail->>Admin: toast "Employee marked INACTIVE"
    Detail->>Detail: refresh button on audit log<br/>shows new UPDATE entry at top
```

### 6c. Deleting an employee with cascade soft-close

The most complex single action in the system. One DELETE produces multiple audit entries.

```mermaid
sequenceDiagram
    actor Admin
    participant Detail as Detail page
    participant Dialog as Confirm dialog
    participant Facade as EmployeeFacade
    participant API as DELETE /api/employees/:id
    participant EmpSvc as EmployeeService
    participant EmpRepo as EmployeeRepository
    participant AcctRepo as AccountRepository
    participant Audit as AuditService

    Admin->>Detail: click "Delete"
    Detail->>Dialog: confirmOpen.set(true)<br/>focus captured & moved to Cancel
    Admin->>Dialog: click "Delete" (confirm)
    Dialog->>Detail: emit (confirmed)
    Detail->>Facade: facade.delete(id)
    Facade->>API: DELETE /api/employees/:id

    API->>EmpSvc: remove(id, ctx)
    EmpSvc->>EmpRepo: findById(id)
    EmpRepo-->>EmpSvc: employee row
    EmpSvc->>AcctRepo: findByEmployeeId(id)<br/>filter status==='OPEN'
    AcctRepo-->>EmpSvc: openAccountsSnapshot[]
    EmpSvc->>EmpRepo: deleteById(id)
    EmpSvc->>AcctRepo: updateAllByEmployeeId(id,<br/>{ status: 'CLOSED' })

    EmpSvc->>Audit: recordEmployeeDeleted(employee)
    Note right of Audit: Entry: DELETE + snapshot
    loop For each OPEN account
        EmpSvc->>Audit: recordAccountCascadeClosed(acct)
        Note right of Audit: Entry: CASCADE_CLOSE +<br/>reason "Owner employee deleted"
    end

    EmpSvc-->>API: 204 No Content
    API-->>Facade: deleteSuccess action
    Facade->>Detail: navigate back to list<br/>focus restored to Delete button
    Detail->>Admin: toast "Employee deleted"

    Note over Detail,Audit: Audit trail outlives the deleted row.<br/>GET /api/employees/:id/audit still resolves<br/>even though the row is gone.
```

### 6d. Adding an account

```mermaid
sequenceDiagram
    actor Admin
    participant Detail as Detail page
    participant AcctList as AccountList child
    participant Form as Account form
    participant Facade as AccountFacade
    participant API as POST /api/employees/:id/accounts
    participant Service as AccountService
    participant Audit as AuditService

    Admin->>AcctList: click "+ Add account"
    AcctList->>Form: showForm.set(true)<br/>editing.set(null)
    Admin->>Form: fill account-number,<br/>type, currency, balance
    Admin->>Form: click "Add account"
    Form->>Facade: facade.create(employeeId, payload)
    Facade->>API: POST request
    API->>Service: create(employeeId, payload, ctx)
    Service->>Service: uuid + status: 'OPEN'<br/>+ timestamps + balance ?? 0
    Service->>Audit: recordAccountCreated
    Service-->>API: 201 + account
    API-->>Facade: createSuccess action
    Facade->>AcctList: items() updates
    AcctList->>Admin: toast "Account added"<br/>new row in table
```

### 6e. Closing and reopening an account

The status-flip flow demonstrates a non-trivial audit-narrative decision: a CLOSE through the named endpoint produces a `CLOSE` audit action, but the same status change via a generic PATCH produces a `UPDATE` with a diff. The service layer makes the call.

```mermaid
flowchart TB
    Start([User clicks "Close" on a row])
    Confirm{Confirm dialog<br/>shows}
    Cancel([User clicks Cancel<br/>→ noop])
    Submit[User clicks "Close account"]
    PatchOrDelete[/DELETE /api/accounts/:id/]
    Service[AccountService.close]
    UpdateRepo[Repository sets<br/>status: CLOSED]
    AuditClose[AuditService<br/>recordAccountClosed<br/>action: 'CLOSE']
    Done[Toast "Account closed"<br/>Row shows CLOSED badge<br/>Edit/Close → Reopen]

    Reopen([User clicks "Reopen"<br/>on a CLOSED row])
    Patch[/PATCH /api/accounts/:id<br/>body: status: OPEN/]
    PatchSvc[AccountService.patch]
    StatusOnly{Is patch only<br/>a status flip<br/>to OPEN?}
    AuditReopen[AuditService<br/>recordAccountReopened<br/>action: 'REOPEN']
    AuditUpdate[AuditService<br/>recordAccountUpdated<br/>action: 'UPDATE']
    DoneReopen[Toast "Account updated"<br/>Row shows OPEN badge]

    Start --> Confirm
    Confirm -->|cancel| Cancel
    Confirm -->|confirm| Submit
    Submit --> PatchOrDelete
    PatchOrDelete --> Service
    Service --> UpdateRepo
    Service --> AuditClose
    AuditClose --> Done

    Reopen --> Patch
    Patch --> PatchSvc
    PatchSvc --> StatusOnly
    StatusOnly -->|yes| AuditReopen
    StatusOnly -->|no| AuditUpdate
    AuditReopen --> DoneReopen
    AuditUpdate --> DoneReopen

    style AuditClose fill:#EEF2FF,stroke:#1f4ed8
    style AuditReopen fill:#E8F5E8,stroke:#008A00
    style AuditUpdate fill:#FFF6DA,stroke:#B45309
```

**The interesting branch.** `AccountService.patch()` checks whether the incoming patch is *only* a status change, and chooses the audit narrative accordingly. Multi-field PATCHes always produce `UPDATE`, never `CLOSE`/`REOPEN`. This decision lives in the service so the repository stays a dumb append target.

### 6f. Viewing the audit log

The only feature in the app that **doesn't** use NgRx — read-only, single-view, no global state worth managing.

```mermaid
sequenceDiagram
    actor Admin
    participant Detail as Detail page
    participant Audit as EmployeeAuditLog component
    participant ApiSvc as AuditApiService
    participant API as GET /api/employees/:id/audit
    participant Ctrl as AuditController
    participant Svc as AuditService
    participant Repo as AuditRepository

    Admin->>Detail: navigate to employee
    Detail->>Audit: render with [employeeId]
    Audit->>Audit: signals: loading.set(true)
    Audit->>ApiSvc: listForEmployee(id, 1, 50)
    ApiSvc->>API: GET request
    API->>Ctrl: controller.listForEmployee
    Ctrl->>Svc: service.listForEmployee(id, query)
    Svc->>Repo: findByEmployeeId(id)
    Repo-->>Svc: all entries (newest first)
    Svc->>Svc: clamp size at MAX_PAGE_SIZE<br/>paginate
    Svc-->>Ctrl: { items, total, page, size }
    Ctrl-->>API: 200 + envelope
    API-->>ApiSvc: response
    ApiSvc-->>Audit: entries
    Audit->>Audit: signals: entries.set(...)<br/>loading.set(false)
    Audit->>Admin: rendered list<br/>(action badges, diffs, cid)

    Admin->>Audit: click "Refresh"
    Audit->>ApiSvc: re-fetch
```

**Why no NgRx here.** The audit log is read-only, viewed in one place, never cross-referenced. A full NgRx slice for one GET endpoint would be five files of boilerplate. Signals + a simple HTTP service is the right level of ceremony.

---

## 7. State management flow — NgRx + Signals split

```mermaid
flowchart LR
    subgraph Store["NgRx store (global state)"]
        Action[Actions<br/>EmployeePageActions<br/>EmployeeApiActions]
        Reducer[Reducers<br/>createFeature]
        Selector[Selectors<br/>memoised]
        Effect[Effects<br/>HTTP / navigation / toasts]
    end

    subgraph Bridge["Bridge layer"]
        Facade["Facade<br/>exposes Observables"]
    end

    subgraph Leaf["Leaf — component"]
        toSig["toSignal()<br/>bridges facade obs"]
        sig["signal()<br/>local UI state"]
        comp["computed()<br/>derived view-model"]
        eff["effect()<br/>state → DOM"]
        Template["Template<br/>{{ items() }}"]
    end

    Action --> Reducer
    Action --> Effect
    Effect --> Action
    Reducer --> Selector
    Selector --> Facade
    Facade --> toSig
    toSig --> Template
    sig --> Template
    sig --> comp
    toSig --> comp
    comp --> Template
    toSig --> eff
    eff -.->|document.title<br/>setTimeout<br/>etc| External([External DOM])
    Template -->|click| Facade
    Facade --> Action

    style Store fill:#FFF6DA,stroke:#B45309
    style Bridge fill:#EEF2FF,stroke:#1f4ed8
    style Leaf fill:#E8F5E8,stroke:#008A00
```

**The boundary.** NgRx owns global state. The facade is the public surface. Signals live only inside the component layer. The arrow direction matters: components dispatch *into* the store via the facade; data flows *out* of the store back via signals.

---

## 8. Cross-cutting concerns

Four pipelines that touch many features. Each is shown as a focused flow so it's easy to reason about in isolation.

### 8a. Correlation-id end-to-end

```mermaid
sequenceDiagram
    participant Client as Angular client
    participant CidI as correlationIdInterceptor
    participant Express as Express middleware
    participant Logger as morgan logger
    participant Ctrl as Controller
    participant Svc as Service
    participant Audit as AuditService
    participant Logs as Server stdout

    Client->>CidI: any HTTP request
    CidI->>CidI: generate uuid<br/>(or use crypto.randomUUID)
    CidI->>Express: header X-Correlation-Id: abc-123
    Express->>Express: middleware/correlation-id.js<br/>echo header back<br/>attach req.correlationId
    Express->>Logger: req object with cid
    Logger->>Logs: "POST /api/employees 201 12ms - cid=abc-123"
    Express->>Ctrl: route handler
    Ctrl->>Svc: service.method(payload, { correlationId: req.correlationId, actor: 'admin' })
    Svc->>Audit: record* entries include cid

    Note over Client,Audit: Browser keeps cid in HttpContext.<br/>Errors normalised by errorInterceptor<br/>include cid for traceability.<br/>Audit entries are queryable by cid.
```

### 8b. Error normalisation pipeline

```mermaid
flowchart TB
    Start([HTTP error or network failure])
    ErrI[errorInterceptor<br/>catchError pipe]
    HasProblemDetails{err.error has<br/>title field?}
    UseBackendError[Build ApiError from<br/>backend problem-details]
    UseFallback[Fallback ApiError:<br/>title = statusText<br/>detail = network or generic]
    AttachCid[Attach correlationId from<br/>response or request header]
    LogErr[LoggerService.error<br/>with url, method, status, cid]
    ThrowAsApi[throwError → ApiError]
    EffectCatch[NgRx effect catchError<br/>dispatches *Failure action]
    ReducerErr[Reducer stores error<br/>in feature state]
    Toast[employeeFailureToast effect<br/>shows error toast]

    Start --> ErrI
    ErrI --> HasProblemDetails
    HasProblemDetails -->|yes| UseBackendError
    HasProblemDetails -->|no| UseFallback
    UseBackendError --> AttachCid
    UseFallback --> AttachCid
    AttachCid --> LogErr
    LogErr --> ThrowAsApi
    ThrowAsApi --> EffectCatch
    EffectCatch --> ReducerErr
    EffectCatch --> Toast

    style ErrI fill:#FBE7EB,stroke:#C7102E
    style Toast fill:#FBE7EB,stroke:#C7102E
```

### 8c. Validation chain (client + server)

Validation runs **twice** by design — the client validates for UX, the server validates because the client can be bypassed.

```mermaid
sequenceDiagram
    participant User
    participant Form as Reactive form
    participant SyncV as Sync validators<br/>(required, pattern, etc.)
    participant AsyncV as Async validator<br/>(unique-email)
    participant API as GET /email-available
    participant Submit as Form submit
    participant Server as Express controller
    participant ServerV as Server validators
    participant ServerSvc as Service

    User->>Form: type into field
    Form->>SyncV: run on each change
    SyncV-->>Form: errors[]
    Form->>Form: show field-error<br/>aria-describedby<br/>aria-invalid

    User->>Form: tab off email (updateOn: 'blur')
    Form->>AsyncV: debounce 150ms
    AsyncV->>API: GET /email-available
    API-->>AsyncV: { available: true/false }
    AsyncV-->>Form: null or { emailTaken: true }

    User->>Form: click Submit
    Form->>Submit: markAllAsTouched()<br/>check form.invalid
    Submit->>API: POST payload
    API->>Server: route handler
    Server->>ServerV: validator.validateCreate
    ServerV-->>Server: errors[]

    alt errors.length === 0
        Server->>ServerSvc: service.create
        ServerSvc-->>Server: created entity
        Server-->>API: 201
    else errors.length > 0
        Server-->>API: 400 problem-details<br/>with errors[]
        API-->>Form: form.controls.* error<br/>via error interceptor → effect
        Form->>User: form-error-summary<br/>role="alert"<br/>aria-live="assertive"
    end
```

### 8d. Audit recording pipeline

```mermaid
flowchart TB
    Write([Any write happens in a service])
    SnapBefore[Snapshot before via<br/>repository.findById]
    DoWrite[repository.insert/update/delete]
    SnapAfter[Snapshot after if applicable]
    Decide{Action type?}

    Create[recordEmployeeCreated<br/>snapshot of tracked fields]
    Delete[recordEmployeeDeleted<br/>snapshot before]
    Update[recordEmployeeUpdated<br/>diff before vs after]
    Close[recordAccountClosed<br/>named narrative]
    Reopen[recordAccountReopened<br/>named narrative]
    Cascade[recordAccountCascadeClosed<br/>with reason]

    NoChange{Diff result<br/>empty?}
    Skip([Return null<br/>no entry written])

    Compose[Compose baseEntry:<br/>entryId uuid<br/>employeeId FK<br/>resource<br/>resourceId<br/>action<br/>actor<br/>correlationId<br/>timestamp]
    Append[AuditRepository.append<br/>push to store.auditLog]
    Done([Entry persists forever])

    Write --> SnapBefore
    SnapBefore --> DoWrite
    DoWrite --> SnapAfter
    SnapAfter --> Decide

    Decide -->|create| Create
    Decide -->|delete| Delete
    Decide -->|update| Update
    Decide -->|close| Close
    Decide -->|reopen| Reopen
    Decide -->|cascade| Cascade

    Update --> NoChange
    NoChange -->|yes| Skip
    NoChange -->|no| Compose
    Create --> Compose
    Delete --> Compose
    Close --> Compose
    Reopen --> Compose
    Cascade --> Compose

    Compose --> Append
    Append --> Done

    style Skip fill:#FBE7EB,stroke:#C7102E
    style Done fill:#E8F5E8,stroke:#008A00
```

**The rule.** No-op UPDATEs don't pollute the trail. Every other action always produces an entry. This rule lives in the service (specifically `AuditService.recordEmployeeUpdated` / `recordAccountUpdated`), not the controller, so any path that calls the service inherits it.

---

## 9. Data model — entity relationships

```mermaid
erDiagram
    EMPLOYEE ||--o{ ACCOUNT : owns
    EMPLOYEE ||--o{ AUDIT_ENTRY : has-trail-of
    ACCOUNT ||--o{ AUDIT_ENTRY : has-trail-of

    EMPLOYEE {
        string employeeId PK "UUID"
        string firstName "2-60 chars"
        string lastName "2-60 chars"
        string email "unique, lowercased"
        string role "ADMIN | MANAGER | SUPPORT"
        string status "ACTIVE | INACTIVE"
        string createdAt "ISO timestamp"
        string updatedAt "ISO timestamp"
    }

    ACCOUNT {
        string accountId PK "UUID"
        string employeeId FK "→ EMPLOYEE.employeeId"
        string accountNumber "8-19 digits, unique"
        string accountType "CHECKING | SAVINGS"
        string currency "CAD | USD"
        number balance "≥ 0, ≤ MAX_BALANCE"
        string status "OPEN | CLOSED"
        string createdAt "ISO timestamp"
        string updatedAt "ISO timestamp"
    }

    AUDIT_ENTRY {
        string entryId PK "UUID"
        string employeeId FK "→ EMPLOYEE.employeeId<br/>(persists after employee deletion)"
        string resource "Employee | Account"
        string resourceId "employeeId or accountId"
        string action "CREATE | UPDATE | DELETE | CLOSE | REOPEN | CASCADE_CLOSE"
        string actor "currently always 'admin'"
        string correlationId "from request header"
        string timestamp "ISO"
        json snapshot "for CREATE/DELETE"
        json changes "for UPDATE diff[]"
        string accountNumber "for Account entries"
        string reason "for CASCADE_CLOSE"
    }
```

**Key constraint not visible above.** `AUDIT_ENTRY.employeeId` is an FK *in spirit only*. When an employee is hard-deleted, the audit entries persist by design — the trail outlives the row. The FK column means "this entry belongs to the audit trail named by this employee id", not "this entry has a live FK target".

---

## 10. Audit log entry shape per action

The audit entry is a discriminated record. Which optional fields are present depends on `action`. Visual reference:

```mermaid
classDiagram
    class AuditEntryBase {
        entryId: UUID
        employeeId: string (FK)
        resource: 'Employee' | 'Account'
        resourceId: string
        action: AuditAction
        actor: string
        correlationId: string | null
        timestamp: ISO string
    }

    class CreateEntry {
        snapshot: TrackedFields
    }

    class UpdateEntry {
        changes: ChangeArr
    }

    class DeleteEntry {
        snapshot: TrackedFields (pre-delete)
    }

    class CloseEntry {
        accountNumber: string
    }

    class ReopenEntry {
        accountNumber: string
    }

    class CascadeCloseEntry {
        accountNumber: string
        reason: string
    }

    class ChangeArr {
        field: string
        before: unknown
        after: unknown
    }

    AuditEntryBase <|-- CreateEntry
    AuditEntryBase <|-- UpdateEntry
    AuditEntryBase <|-- DeleteEntry
    AuditEntryBase <|-- CloseEntry
    AuditEntryBase <|-- ReopenEntry
    AuditEntryBase <|-- CascadeCloseEntry
    UpdateEntry "1" o-- "*" ChangeArr : has
```

The renderer (`EmployeeAuditLogComponent`) pattern-matches on `action` and picks the right detail shape.

---

## 11. Dev environment orchestration

What actually happens when you run `npm start` from the project root.

```mermaid
flowchart LR
    NpmStart[npm start at root]
    Concurrent[concurrently -k -n SERVER,CLIENT]

    subgraph ServerProc["Server process"]
        StartSvr["npm --prefix server start"]
        NodeSvr["node server.js"]
        Express[":3000 Express<br/>listening"]
    end

    subgraph ClientProc["Client process"]
        StartCli["npm --prefix client start"]
        Ng["ng serve --proxy-config"]
        Webpack["Webpack dev server"]
        Angular[":4200 Angular SPA"]
    end

    Browser([Browser])

    NpmStart --> Concurrent
    Concurrent --> StartSvr
    Concurrent --> StartCli
    StartSvr --> NodeSvr --> Express
    StartCli --> Ng --> Webpack --> Angular

    Browser -->|http://localhost:4200| Angular
    Angular -.->|proxy /api/*| Express

    style ServerProc fill:#FFF6DA,stroke:#B45309
    style ClientProc fill:#E8F5E8,stroke:#008A00
```

**The flag `-k` is what makes this safe.** When either process dies, `concurrently` kills the other. No half-running stacks if you Ctrl+C the terminal.

---

## 12. Testing pipeline

What runs where, and what each test layer is responsible for.

```mermaid
flowchart TB
    subgraph Backend["Backend tests (Jest)"]
        JestSpec[__tests__/services/<br/>audit.service.test.js<br/>employee.service.test.js]
        Reset[resetStore helper<br/>between tests]
        InMem[(In-memory<br/>store)]
        JestSpec --> Reset --> InMem
    end

    subgraph Frontend["Frontend unit (Karma + Jasmine)"]
        Reducer[employee.reducer.spec.ts]
        Effect[employee.effects.spec.ts<br/>provideMockActions]
        ApiSvc[employee-api.service.spec.ts<br/>HttpTestingController]
        FormSpec[employee-form.component.spec.ts<br/>spied facade]
    end

    subgraph E2E["End-to-end (Cypress)"]
        EmpFlow[employee-flow.cy.ts]
        AcctFlow[account-flow.cy.ts]
        AuditFlow[audit-log-flow.cy.ts]
        Filters[employee-filters.cy.ts]
        DevServer{{Requires npm start<br/>running on 4200 + 3000}}
        Cypress[Cypress runner]

        EmpFlow & AcctFlow & AuditFlow & Filters --> Cypress
        Cypress --> DevServer
    end

    Commands[["Commands<br/>npm run test:server (Jest)<br/>npm test (Karma)<br/>npm run e2e (Cypress)<br/>npm run test:all (Jest + Karma)"]]

    style Backend fill:#FFF6DA,stroke:#B45309
    style Frontend fill:#EEF2FF,stroke:#1f4ed8
    style E2E fill:#E8F5E8,stroke:#008A00
```

**Coverage rules.** Backend Jest tests target the two highest-risk services (the audit-diff computation and the cascade-close logic). Frontend Karma tests target the canonical NgRx layers (reducer, effect, service, form). Cypress catches integration bugs across both stacks.

---

## One paragraph to internalise

> Every diagram above describes a real piece of this codebase you can open and point at. The system architecture matches `app.js` + `app.config.ts`; the layered backend matches the folder layout under `server/`; the request lifecycle matches what you see in the Network tab when you click a button. None of this is aspirational — it's all in the repo. Drawing it on a whiteboard during the interview is a 60-second exercise *because* I drew it here first.

---

*Banking Admin Portal — architecture & workflow reference.*