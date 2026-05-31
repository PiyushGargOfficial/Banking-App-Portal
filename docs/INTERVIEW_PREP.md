# Interview Prep — How to Present This Project (Demo Delivery Guide)

> The **practical delivery companion** to [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md).
> The playbook is the *strategy* (pitch, decision trees, Q&A, how to tailor by
> interviewer). **This doc is the actual show:** how to record a demo video, the
> diagrams to put on screen, the exact code snippets to open, and the
> minute-by-minute script for walking an interviewer through the app.

If you only have 20 minutes to present, follow [Section 3 — the live demo
script](#3-the-live-demo-script-1820-minutes). If you're recording a video, follow
[Section 4](#4-demo-video-plan-record-once-reuse-everywhere).

---

## Table of contents

1. [What format to use (and the recommended mix)](#1-what-format-to-use-and-the-recommended-mix)
2. [Diagrams to put on screen](#2-diagrams-to-put-on-screen)
3. [The live demo script (18–20 minutes)](#3-the-live-demo-script-1820-minutes)
4. [Demo video plan (record once, reuse everywhere)](#4-demo-video-plan-record-once-reuse-everywhere)
5. [The "hero" code snippets — what to open and what to say](#5-the-hero-code-snippets--what-to-open-and-what-to-say)
6. [Setup checklist & failure recovery](#6-setup-checklist--failure-recovery)
7. [One-page cheat sheet](#7-one-page-cheat-sheet)

---

## 1. What format to use (and the recommended mix)

You asked: video, diagrams, or code snippets? The senior answer is **all three,
layered** — each does a job the others can't:

| Medium | Its job | Where it shines |
|---|---|---|
| **Architecture diagram** | Show you can think in *systems*, not files | First 3 minutes — frame the whole thing before touching code |
| **Live app demo** | Prove it actually works, end to end | The middle — CRUD, audit log, validation, accessibility |
| **Code snippets** | Show *how* you think, the craft | On demand — when they ask "show me how X works" |
| **Demo video (pre-recorded)** | Insurance + async submission | Send ahead, or fall back to it if live setup fails |

**The recommended structure for a live interview:**

```
 1. Diagram first  (3 min)  → "here's the system"
 2. Live app demo  (8 min)  → "here's it working"
 3. Code deep-dive (6 min)  → "here's the one decision I'm proudest of"
 4. Stop & invite  (—)      → "where do you want to go deeper?"
```

Lead with the diagram, not the code. Juniors open the IDE first; seniors draw the
box-and-arrow picture first and earn the right to zoom in.

---

## 2. Diagrams to put on screen

Have these ready as images (or be able to sketch them live). The full
hand-drawable system diagram lives in
[INTERVIEW_PLAYBOOK.md §4](./INTERVIEW_PLAYBOOK.md#4-architecture-you-can-draw-on-the-fly).
Below are the three you actually narrate.

### 2a. System overview (the 30-second version)

```
   Browser
     │
     ▼
  Angular 17 (standalone, :4200)
     Component → Facade → NgRx store → HTTP interceptors
        ▲ signals      (source of truth)   ├─ correlation-id
        └ toSignal()                       └─ error → ApiError
     │  proxy /api/*
     ▼
  Express mock (:3000)
     Routes → Controllers → Services → Repositories → in-memory store
              (HTTP only)   (rules +     (pure CRUD)
                            audit)
```

**Say:** *"Two processes in dev. Angular owns state in NgRx and bridges to signals
at the leaf. Express is a strict layered stack so the business rules are testable
without an HTTP server. Everything below the store is the only place data
mutates."*

### 2b. NgRx unidirectional data flow (draw this when they ask about state)

```
  Component ──dispatch action──►  Effect ──calls──►  API service ──HTTP──► Express
     ▲                              │
     │                              ▼ (success/failure action)
     │                            Reducer ──updates──► Store
     │                                                   │
     └────────── Selector ◄── Facade exposes Observable ─┘
                    │
                    ▼  toSignal()
              template reads signal()
```

**Say:** *"One direction. The component never mutates state — it dispatches. The
effect is the only thing that talks to HTTP. The reducer is the only thing that
writes the store. The facade is the read/write interface the component sees, so
the component never imports an action or a selector directly."*

### 2c. Write-with-audit sequence (the banking-flavoured one)

```
 Admin clicks "Mark INACTIVE"
   → PATCH /api/employees/:id { status }
     → controller: sanitize → validate → service.patch()
        → repo.findById()        (snapshot BEFORE)
        → repo.update()          (write)
        → AuditService.recordEmployeeUpdated(before, after)
             → diff() → { field:'status', before:'ACTIVE', after:'INACTIVE' }
   ← 200 + updated employee
 UI: NgRx updates → audit-log component shows the new entry at the top
```

**Say:** *"Every write snapshots the row before mutating, then records a
field-level diff. That's the compliance story — you can answer 'who changed what,
when' for any record."*

---

## 3. The live demo script (18–20 minutes)

This is the spine. Rehearse it until the *clicks* are muscle memory so your brain
is free for the *narration*.

### Minute 0–1 · Frame it
> *"This is a Banking Admin Portal — a back-office tool to manage employees and
> their linked accounts. It's a take-home, but I built it production-**shaped**:
> layered backend, audit log, accessibility pass, responsive. Let me show you the
> system first, then it running, then the one piece of code I'm proudest of."*

Put up [diagram 2a](#2a-system-overview-the-30-second-version). Narrate the five layers. **Then stop.**

### Minute 1–4 · The list page (architecture made visible)
1. Open <http://localhost:4200> → employee list.
2. **Search** "lee" → narrate: *"debounced, drives a query param, server-side filter."*
3. **Filter** by role/status → *"composes with AND semantics; any filter change resets to page 1."*
4. **Sort** a column, **page** through → *"sorting and pagination are server-side, so the client always gets a bounded payload — that matters at scale."*

**Subtext you're signalling:** search/filter/sort/pagination is the bonus tier, and it's real, not faked client-side.

### Minute 4–8 · Detail + the audit log (the showpiece)
1. Click an employee → detail page.
2. Point out **parent → child**: *"the detail page (parent) passes the employee id down to the account list (child) via an `@Input`."*
3. **Toggle status** ACTIVE → INACTIVE.
4. Scroll to the **audit log** → *"the UPDATE entry just appeared at the top with a clean `status: ACTIVE → INACTIVE` diff. Banks audit everything; this is append-only with correlation-id traceability."*
5. **Add an account**, then **close it** → show the CLOSE entry and the **masked account number** (`••••7766`).

### Minute 8–11 · The form (validation UX)
1. Go to **New / Edit employee**.
2. Submit empty → *"control-level errors appear only after touch, one message at a time."*
3. Type a **duplicate email**, blur → *"async validator hits the backend on blur — `checking availability…` then `already used`. The submit button stays enabled so a click surfaces every error at once."*
4. (Optional) DevTools → Network → show the `email-available` call.

### Minute 11–13 · Accessibility you can't fake
1. Trigger **delete** → confirm dialog opens, **focus lands on Cancel**.
2. Press **Escape** → dialog closes *and* focus returns to the Delete button.
3. *"`role="dialog"`, `aria-modal`, focus trap, focus return — the WAI-ARIA modal pattern, hand-rolled so it's visible in the code."*

### Minute 13–15 · Correlation-id end to end
1. DevTools → Network → trigger any write.
2. Show the `X-Correlation-Id` request header → switch to the server terminal → show the **same id** in the morgan log line.
3. *"Client interceptor mints it, Express echoes it, the log ties them together. Pipe that into OpenTelemetry and you have request tracing with zero app changes."*

### Minute 15–20 · One code deep-dive + invite
Pick **one** hero snippet from [Section 5](#5-the-hero-code-snippets--what-to-open-and-what-to-say) — the cascade `remove()` is the strongest — walk it, then:
> *"That's the tour. Where would you like to go deeper — the NgRx wiring, the backend layering, or the trade-offs I'd reverse?"*

**Then stop talking.** Letting them choose is the senior move.

---

## 4. Demo video plan (record once, reuse everywhere)

A 5–7 minute screen recording you can attach to the submission or fall back on if
live setup dies. Keep it tight; edit out dead air.

**Tools:** OBS / Loom / built-in screen recorder. 1080p, show your cursor, talk over it.

| Scene | Time | On screen | Say (scripted) |
|---|---|---|---|
| 1. Title + framing | 0:00–0:30 | The diagram ([2a](#2a-system-overview-the-30-second-version)) | The 30-second pitch from [playbook §3](./INTERVIEW_PLAYBOOK.md#3-the-2-minute-pitch-rehearsed) |
| 2. List page | 0:30–1:45 | Search / filter / sort / paginate | "Server-side, bounded payloads, resets to page 1 on filter" |
| 3. Detail + audit | 1:45–3:15 | Toggle status, add+close account | "Append-only audit, field-level diff, masked account number" |
| 4. Form validation | 3:15–4:30 | Empty submit, duplicate email | "Reactive forms, async unique-email on blur, problem-details errors" |
| 5. A11y + correlation-id | 4:30–5:30 | Escape closes dialog; Network → log | "Focus return; one id across client and server" |
| 6. One code snippet | 5:30–6:45 | `employee.service.js` `remove()` | "Cascade soft-close + audit in one cohesive service function" |
| 7. Close | 6:45–7:00 | README / docs folder | "Full decision log is in docs/. Happy to go deeper on any of it." |

**Recording tips:**
- Do a dry run first — the in-memory store reseeds on restart, so restart the server right before recording for a clean dataset.
- Pre-open every tab/file you'll switch to. No fumbling.
- One take per scene; stitch in editing. Re-record a scene rather than apologising on camera.

---

## 5. The "hero" code snippets — what to open and what to say

Open these from the real files (links below). Don't paste from memory in the room
— click into the actual file so they see it's real.

### 5a. The backend's best moment — cascade delete + audit

[server/services/employee.service.js](../server/services/employee.service.js) → `remove()`:

```js
remove(employeeId, context) {
  const employee = EmployeeRepository.findById(employeeId);
  if (!employee) return false;

  // Snapshot the accounts that are about to be cascade-closed.
  const accountsToClose = AccountRepository.findByEmployeeId(employeeId)
    .filter((a) => a.status === 'OPEN')
    .map((a) => ({ ...a }));

  EmployeeRepository.deleteById(employeeId);
  AccountRepository.updateAllByEmployeeId(employeeId, { status: 'CLOSED', updatedAt: nowIso() });

  AuditService.recordEmployeeDeleted(employee, context);
  for (const acc of accountsToClose) {
    AuditService.recordAccountCascadeClosed(acc, context);
  }
  return true;
}
```

**Say:** *"This is why the service layer exists. One business rule — 'deleting an
employee must not leave dangling open accounts' — orchestrates two repositories
and the audit service in a transaction-shaped function. Controllers can't do this
(they're HTTP-only), repositories can't (they're pure CRUD). It has its own Jest
suite, so I can prove the cascade works without booting an HTTP server."*

### 5b. The frontend's best seam — Signals bridged onto NgRx

[employee-detail.component.ts](../client/src/app/features/employees/pages/employee-detail/employee-detail.component.ts):

```ts
protected readonly employee = toSignal(this.facade.selected$, { initialValue: null });

constructor() {
  // state-driven DOM side effect: keep the tab title in sync
  effect(() => {
    const emp = this.employee();
    document.title = emp ? `${emp.firstName} ${emp.lastName} - ${DEFAULT_TITLE}` : DEFAULT_TITLE;
  });
}
```

**Say:** *"NgRx stays the source of truth. Signals show up at exactly three seams:
`toSignal()` to bridge a facade observable to the template, `signal()` for
component-local UI state, and `effect()` for state-driven DOM side effects like
this title sync. I didn't replace NgRx with signals — I bolted them on at the
leaf."*

### 5c. The async validator (forms craft)

[unique-email.validator.ts](../client/src/app/core/validators/unique-email.validator.ts):

```ts
return of(value).pipe(
  debounceTime(150),        // don't hit the API on every keystroke
  distinctUntilChanged(),
  switchMap((email) => api.isEmailAvailable(email, excludeIdProvider()).pipe(
    map((available) => (available ? null : { emailTaken: true })),
    catchError(() => of(null)) // network error → don't block submit; server re-checks
  )),
  first()
);
```

**Say:** *"A validator factory so it can take the API service and an
`excludeIdProvider` — in edit mode the employee's own email mustn't count as a
clash. Debounced, deduped, fails-open on network error because the server
re-validates on submit anyway. Wired with `updateOn: 'blur'` so it only fires when
the user leaves the field."*

### 5d. Two interceptors, ordered on purpose

[app.config.ts](../client/src/app/app.config.ts):

```ts
provideHttpClient(withFetch(), withInterceptors([correlationIdInterceptor, errorInterceptor]))
```

**Say:** *"Order matters — correlation-id runs first so the error interceptor can
read the id it attached and log it. Both are functional interceptors, the modern
tree-shakeable style, not the old class-based provider."*

### Snippet-selection rule

Show **one** in a live interview unless they ask for more. 5a is the strongest
single choice because it's the clearest "this is why I layered it this way" story.

---

## 6. Setup checklist & failure recovery

### Before you present
- [ ] `npm run install:all` once (pre-warm node_modules).
- [ ] **Restart** `npm start` right before — fresh seed (33 employees, 12 accounts).
- [ ] Open tabs: running app, GitHub/repo, `docs/` folder, the IDE on `employee.service.js`.
- [ ] DevTools docked, Network + Console tabs visible.
- [ ] Server terminal visible (for the correlation-id log moment).
- [ ] This doc + [playbook](./INTERVIEW_PLAYBOOK.md) on a second screen — for glancing, not reading.

### If something breaks live
Don't panic — narrate it as a debug session (that *is* the senior signal):
> *"Looks like the proxy didn't forward — in a real product this is where I'd open
> the Network tab and check the response URL."*

And have the **pre-recorded video** ready to switch to: *"Setup's being stubborn —
let me show you the recorded walkthrough and we can dig into any part live
after."* A working fallback turns a disaster into a non-event.

---

## 7. One-page cheat sheet

**Order:** Diagram → Live demo → One code snippet → Stop & invite.

**Demo clicks, in order:**
1. List: search → filter → sort → paginate
2. Detail: parent/child `@Input`, toggle status, **watch audit log**
3. Account: add → close (masked number, CLOSE entry)
4. Form: empty submit (control errors) → duplicate email (async on blur)
5. Dialog: delete → **Escape returns focus**
6. DevTools: `X-Correlation-Id` request header == server log line
7. Code: `employee.service.js` `remove()` cascade

**Three sentences that signal seniority:**
- *"NgRx is the source of truth; signals appear at three specific seams."*
- *"Every write snapshots before mutating and records a field-level diff."*
- *"It's production-**shaped**, not production-**ready** — in-memory store, no auth, no CI; swapping the store for Postgres only touches the repositories."*

**End with a curiosity flip:** *"What does a great senior-Angular demo look like to
you — I'd rather hear what you wish more candidates did."*

---

*See also: [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md) (strategy, pitch, Q&A,
trade-off decision tree), [ANGULAR_FUNDAMENTALS_GUIDE.md](./ANGULAR_FUNDAMENTALS_GUIDE.md),
[NGRX_GUIDE.md](./NGRX_GUIDE.md), and [ASSIGNMENT_COMPLIANCE_AUDIT.md](./ASSIGNMENT_COMPLIANCE_AUDIT.md).*
