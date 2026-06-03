# Interview Overview and Questions

> A short, interview-ready overview of the Banking Admin Portal: the pitch,
> what's strong, what's weak, and a Q&A bank with tight answers you can actually
> say out loud. Deeper versions of everything here live in the other `docs/`.

---

## 1. The pitch (≈90 seconds — say this)

> "It's a **Banking Admin Portal** — an internal tool to manage employees and
> their linked banking accounts. It was a take-home, but I built it
> **production-shaped**: an Angular 17 standalone frontend with **NgRx + Signals**,
> and an Express mock backend with a strict **MVC + service + repository** stack.
>
> Three decisions I'd highlight. First, I kept **NgRx as the single source of
> truth and added Signals only at the leaf** — `toSignal` to read state in
> templates, `signal` for local UI flags, `effect` for DOM side-effects. Second, I
> **layered the backend** so business rules — like cascade-closing accounts when an
> employee is deleted — are unit-testable against a stub repository, and the store
> is swappable to Postgres by touching one layer. Third, I added an **append-only
> audit log** with field-level diffs and correlation-id tracing, because banks
> audit everything.
>
> Every required feature plus all three bonus items, tests concentrated on the two
> highest-risk services, four Cypress e2e flows. It's **production-shaped, not
> production-ready** — no auth, in-memory store, no CI — and I wrote my own
> senior-dev review of those gaps, since there was no second reviewer."

---

## 2. What's good

**Architecture**
- Standalone Angular 17, clean `core / shared / features` split, **two-level lazy loading** (`loadChildren` + `loadComponent`).
- Backend: strict one-way **routes → controllers → services → repositories → store**; storage swappable, business rules testable in isolation.
- **NgRx + Signals hybrid** done deliberately (signals only at three seams), `OnPush` everywhere.

**Domain & correctness**
- **Append-only audit log** — snapshot for CREATE/DELETE, field-level diff for UPDATE, named narrative for CLOSE/REOPEN.
- **Cascade soft-close**: deleting an employee closes their open accounts and keeps the audit trail.
- **Async unique-email validator** (debounced, `updateOn: blur`, excludes own id on edit) backed by a server check.
- Per-currency subtotals + total (explicitly "not FX-converted" — an honest UI call).

**Quality & cross-cutting**
- **Two HTTP interceptors** (correlation-id, error→`ApiError`), ordered on purpose.
- **RFC 7807 problem-details** errors; input sanitisation + validation on both sides.
- **Correlation-id tracing** end to end (client interceptor → Express middleware → morgan log) — OpenTelemetry-ready.
- **`MAX_PAGE_SIZE` clamp** (DoS-hardening) with the clamped value echoed back.
- Accessible hand-rolled **confirm dialog** (focus trap, Escape, focus return).
- Tests: **4 frontend unit + 2 backend Jest + 4 Cypress e2e**, concentrated on the riskiest code.
- Honest, written **self-review** of the gaps (README §10).

## 3. What's weak / future improvements

**Critical for production**
- **No authentication** — every audit `actor` is hardcoded `'admin'`. JWT middleware unblocks it.
- **Validation rules duplicated** client + server (name regex, `MAX_BALANCE`, account-number pattern) → silent contract-drift risk. Fix: a shared package.
- **In-memory store** — no persistence; resets on restart. Repository pattern makes Postgres a one-layer swap.

**Should fix**
- **No CI pipeline**, no rate limiting, no request-body size cap.
- **No direct tests** on validators / controllers / middleware (only covered transitively via Cypress).
- **PII in logs** — services log full models (email, balance) at info level; should gate behind `LOG_LEVEL=debug`.

**Nice to have**
- `prefers-reduced-motion` not respected; confirm dialog could use `@angular/cdk/dialog`.
- No optimistic updates; filters/pagination reset on refresh (could sync to URL via the existing router-store); audit-log frontend doesn't paginate; no HTTP request timeouts.

---

## 4. Interview Q&A (short answers)

**Q. Why NgRx *and* Signals? Where's the boundary?**
NgRx stays the single source of truth for shared state. Signals appear only at the leaf: `toSignal()` to read facade streams synchronously in templates, `signal()` for component-local UI flags, `effect()` for DOM side-effects like the document title. I didn't replace NgRx — I bolted signals on at the component edge.

**Q. Why split the backend into service + repository instead of one file?**
So business rules are testable without HTTP and the storage engine is swappable. The repository is pure CRUD; the service owns rules like cascade-delete and audit. Cost is more files; the win is the cascade logic has its own Jest suite and Postgres would touch only the repository.

**Q. How does the audit log work, and why append-only?**
Every write records an immutable entry — full snapshot on create/delete, a `{field, before, after}` diff on update. The repository exposes no update/delete, and entries outlive the parent row. Append-only is the compliance requirement and also makes it event-sourcing-ready.

**Q. Why soft-delete accounts but hard-delete employees?**
Accounts soft-close so balances and history survive operationally. Employees are removed, but the delete cascades a soft-close to their open accounts and the audit entries persist — so history isn't lost. Hard-deleting everything would destroy the compliance trail.

**Q. How does the unique-email validation work?**
An Angular async validator calls `GET /employees/email-available` on blur, debounced and deduped, returning `null` on network error so a flaky network can't block submit. The server re-checks on write and a DB-level unique constraint would back it in production.

**Q. Why two interceptors, and does order matter?**
Yes. `correlationIdInterceptor` runs first to attach `X-Correlation-Id`; `errorInterceptor` runs after so it can read that id when normalising `HttpErrorResponse` into our `ApiError` and logging it. Errors flow to the effect's `catchError`, keeping the store the source of UI error state.

**Q. How is error handling done end to end?**
Server returns RFC 7807 problem-details. The client error interceptor normalises it to `ApiError`, preserves the correlation id, and rethrows. NgRx effects catch it and write `error` into state; the form shows a server-error summary.

**Q. How do you prevent a page-size DoS?**
The list endpoints clamp `?size=` to `MAX_PAGE_SIZE` (100) with `Math.min`, and echo the clamped value back. I clamp rather than reject because there's one known client — graceful degradation without breaking a caller that didn't know the limit.

**Q. What's your change-detection strategy?**
`OnPush` everywhere, with state flowing through signals/observables so views update on reference changes. It's Zone.js-based, not zoneless — the signal-first style would make a zoneless migration low-friction.

**Q. What's your testing strategy?**
Risk-based: unit-test the two services where a bug silently corrupts data (audit diff, cascade delete), and e2e the four highest-traffic flows in Cypress. Specs use `data-cy` hooks, unique data, and wait on real app state — not timers — so they're non-flaky. The gap is direct validator/controller tests.

**Q. How would you scale this 10x?**
Move the in-memory store to Postgres with targeted indexes — that also makes the API stateless, which unlocks horizontal scaling behind a load balancer. The audit log slots into event-sourcing with a Redis read model; the correlation-id feeds OpenTelemetry with near-zero app change.

**Q. What's missing for production, and what would you fix first?**
Auth, a real database, and CI are the blockers. First five: CI pipeline, validator/controller tests, auth scaffolding, a shared validation package to kill drift, and URL-persisted filter state.

**Q. What's the trade-off you'd reverse?**
The duplicated validation rules across client and server. It's fine at five fields, but a one-sided edit drifts the contract silently. I'd extract them into a shared package both import.

**Q. Biggest thing you solved alone?**
A few: an output-alias bug under strict templates (renamed to past-tense outputs), a pipe-in-`(click)` parser error (fixed by reading a signal), and the dialog focus-management pattern by hand. No reviewer, so I wrote my own review and shipped the top gaps.

**Q. Why standalone components over NgModules?**
It's the Angular 17 default and removes module boilerplate — each component declares its own imports, which makes lazy loading per-route and tree-shaking cleaner.

---

## 5. Flash cards (last-minute review)

Cover the right column; recall it in one breath.

| Prompt | One-line answer |
|---|---|
| NgRx vs Signals? | NgRx is the source of truth; signals only at the leaf (`toSignal` / `signal` / `effect`). |
| Service vs repository? | Repo = pure CRUD; service = rules + audit. Rules testable, store swappable. |
| Audit log? | Immutable entries — snapshot / diff / narrative; no update/delete; compliance + event-sourcing-ready. |
| Soft vs hard delete? | Accounts soft-close; employee hard-delete cascades a soft-close; audit survives. |
| Unique email? | Async validator on blur → server check; fails-open on network error; DB unique constraint in prod. |
| Interceptor order? | Correlation-id first, so the error interceptor can log that id. |
| Error flow? | 7807 → `ApiError` in interceptor → effect `catchError` → store → form summary. |
| Page-size DoS? | Clamp at 100 and echo it back — graceful for the one known client, not a 400. |
| Change detection? | `OnPush` everywhere; Zone.js-based but signal-first, so zoneless is easy. |
| Testing? | Risk-based: unit the 2 riskiest services, e2e the 4 top flows; `data-cy` + unique data + wait on state. |
| Scale 10x? | Postgres + indexes → stateless → horizontal scale; audit → event sourcing + Redis; cid → OpenTelemetry. |
| Missing for prod? | Auth, DB, CI. Fix order: CI, validator tests, auth, shared validation, URL state. |
| Trade-off to reverse? | Duplicated client/server validation → one shared package. |
| Lazy loading? | Two levels: `loadChildren` for the feature, `loadComponent` per page. |
| Why standalone? | Angular 17 default; no module boilerplate; cleaner lazy loading + tree-shaking. |

---

## 6. Behavioral questions (tied to the project)

Short STAR-style answers — Situation/Task compressed, Action + Result emphasised.

**Q. Tell me about a bug you solved with no one to ask.**
A pagination button used a pipe inside a `(click)` action, which Angular's parser silently rejects while pointing the error at the wrong line. I traced it, and instead of the local workaround I migrated the component to read the value as a signal — fixing the bug and cleaning up the template's async-pipe ceremony in one move.

**Q. Tell me about a time you caught a problem before it caused damage.**
I noticed the name regex, balance cap and account-number pattern were duplicated byte-for-byte across the client and server validators. Nothing was broken yet, but a one-sided edit would silently drift what the UI accepts from what the API rejects — so I flagged it as Critical in my own review and documented the fix (a shared package) before it ever bit.

**Q. Tell me about a decision you reversed.**
I started introducing a branded `EmployeeId` type for compile-time FK safety, got two files in, and stopped — the cascade through services, effects, tests and seed data was ~15 files for a marginal win. I reverted to a lightweight type alias: same readability, none of the churn. Knowing when *not* to chase the clever option is the skill.

**Q. How do you keep quality high without a code reviewer?**
There was no second pair of eyes, so I became one: I wrote a senior-dev review of my own work — every gap, untested layer and smell, ranked by blast radius — and shipped the top items (backend service tests, the page-size clamp) in follow-up commits. I also concentrated tests on the two services where a regression would silently corrupt data.

**Q. What part are you most proud of?**
The audit log. It's append-only with per-action shaping — full snapshot on create/delete, a field-level diff on update — attributed to an actor and correlation id, and it survives the parent row being deleted. It turned a one-line bonus in the brief into the project's strongest compliance story.

**Q. Tell me about working under ambiguity.**
The brief was generic CRUD. I treated the spec as a floor, not a ceiling — deciding for myself what "production-shaped at a bank" meant (audit log, accessibility, responsive, DoS-hardening) while staying honest about what I left out (auth, real DB, CI). I documented every one of those calls so the reasoning is reviewable.

---

*See also: [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md) (full prep + decision tree),
[ASSIGNMENT_COMPLIANCE_AUDIT.md](./ASSIGNMENT_COMPLIANCE_AUDIT.md) (spec coverage),
[HOW_WOULD_YOU_SCALE_THIS_10X.md](./HOW_WOULD_YOU_SCALE_THIS_10X.md), and the
[README self-review](../README.md#10-senior-dev-review-whats-missing).*
