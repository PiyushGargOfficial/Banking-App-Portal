# Five-question interview reflection — Banking Admin Portal

**Pre-interview prep: my five answers (2–3 sentences each) plus the supporting context I want fresh in my head when I sit down.**

For: the Senior Angular Developer take-home interview. Each section gives the answer I plan to say out loud, the reasoning behind the wording, and the specific files / decisions I'll point to if the interviewer pushes.

> **Companion doc:** This file is the focused five-question exercise. The broader ten-step preparation — two-minute pitch with all the moves named, ASCII architecture diagram, decision-tree with rejected alternatives, anti-patterns to avoid on this specific project, and a day-before/morning-of checklist — lives in [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md). Read this one for the answers; read the playbook for the surrounding strategy.

---

## Table of contents

1. [TL;DR — the five answers in one screen](#1-tldr--the-five-answers-in-one-screen)
2. [Q1 — What problem were you solving, and for whom?](#2-q1--what-problem-were-you-solving-and-for-whom)
3. [Q2 — What was the single hardest technical decision?](#3-q2--what-was-the-single-hardest-technical-decision)
4. [Q3 — What measurable outcome did the project achieve?](#4-q3--what-measurable-outcome-did-the-project-achieve)
5. [Q4 — What's the biggest thing you'd change?](#5-q4--whats-the-biggest-thing-youd-change)
6. [Q5 — What did you learn that changed how you build software?](#6-q5--what-did-you-learn-that-changed-how-you-build-software)
7. [How to use this document](#7-how-to-use-this-document)
8. [Backup answers (if the interviewer goes deeper)](#8-backup-answers-if-the-interviewer-goes-deeper)

---

## 1. TL;DR — the five answers in one screen

> **Problem.** I built an internal Banking Admin Portal — an Angular app for managing employees and their linked banking accounts, backed by an Express mock API. The user is a bank admin who needs to create, search, filter, and audit employee + account records quickly without dropping into a database. The real-product equivalent would sit behind SSO inside a bank's internal network.
>
> **Hardest decision.** Where to draw the line between NgRx and Angular's new Signals API. I landed on: NgRx remains the global store; signals appear at three specific seams — `toSignal()` bridging facade observables at the component boundary, `signal()` for purely-local UI state, and `effect()` for state-driven DOM side effects.
>
> **Outcome.** Every spec requirement plus all three listed bonus items shipped, with 4 frontend unit-test files, Jest suites on the two highest-risk backend services, and 4 Cypress end-to-end flows. The app is responsive from 360px phones to 4K monitors and hits WCAG 2.1 AA on every interactive surface.
>
> **Biggest change.** Consolidate the validation rules into a shared package. Today the name regex, balance limits, and account-number pattern live in TypeScript on the client and JavaScript on the server, hand-copied. A `packages/shared/` workspace would let both sides depend on a single canonical definition and eliminate the drift risk.
>
> **What I learned.** Good architecture is mostly about putting each piece of code at the right layer, not making it work. The repository + service refactor drove that home — the cascade-close-on-delete logic moved layers without changing what it did, and suddenly it was testable in isolation. "Where does this code belong" is the senior question, not "how do I make it work".

---

## 2. Q1 — What problem were you solving, and for whom?

### The answer (60–90 seconds spoken)

> I built an internal Banking Admin Portal — an Angular app for managing employees and their linked banking accounts, backed by an Express mock API. The user is a bank admin who needs to create, search, filter, and audit employee + account records quickly without dropping into a database or escalating to engineering. The real-product equivalent would sit behind SSO inside a bank's internal network.

### Why this wording

I want to anchor on **"internal admin tool"** in the first sentence because that frames every subsequent design choice: dense information, fast keyboard flows, audit trails, defensive validation, no marketing polish. Saying "bank admin" tells the interviewer I thought about the actual user, not just the rubric.

The "no SSO yet" hint is deliberate — it acknowledges authentication is missing without me having to bring it up later as a weakness.

### If the interviewer pushes

| Follow-up | What to point to |
|---|---|
| "Why these two domains specifically?" | The take-home explicitly required Employee + Account with a foreign-key relationship — choosing them was the spec, not me. I leaned into the implications (cascade soft-close, per-currency subtotals, audit history per employee). |
| "Who would actually use this?" | Picture a bank's back-office team — internal HR or branch support. They open the app behind SSO during their shift, filter to active SUPPORT staff, view a specific employee, and quickly close an account that needs to be archived. |
| "How do you know the design fits that user?" | Honest answer: I don't have user research, this is a take-home. But I treated the rubric's "UI polish" and "error handling" buckets as user proxies — responsive, accessible, fast feedback, descriptive errors. |

---

## 3. Q2 — What was the single hardest technical decision?

### The answer (60–90 seconds spoken)

> Where to draw the line between NgRx and Angular's new Signals API. Too many signals dilutes NgRx's role as the source of truth; too few buys you NgRx's boilerplate for things that are purely local UI flags. I landed on: NgRx remains the global store, signals show up at three specific seams — `toSignal()` to bridge facade observables at the component boundary, `signal()` for purely-local UI state, and `effect()` for state-driven DOM side effects.

### Why this wording

The phrase **"too many… too few…"** signals that I considered both ends of the spectrum and rejected them. That's the senior framing — junior answers usually pick a side and defend it.

Naming the three seams (`toSignal`, `signal`, `effect`) gives the interviewer a way in. They can dig into any one of them. That's deliberate.

### If the interviewer pushes

| Follow-up | What to point to |
|---|---|
| "Show me an example of each pattern." | `EmployeeListComponent` — bridges 6 facade observables via `toSignal()`, holds `query` / `confirmOpen` / `pendingDelete` as `signal()`, and computes `pageSummary` via `computed()`. `EmployeeDetailComponent` adds `effect()` to sync `document.title` to the loaded employee. |
| "Why not migrate the facade itself to signals?" | The facade stays observable-based because other consumers (the audit-log component, the unsaved-changes guard, anything that hooks into RxJS operators) work with observables natively. Components decide individually how they want to consume the streams. |
| "What's the trade-off you accepted?" | Some duplication of state representation — the facade emits an Observable, the component bridges it to a Signal. Mentally there are two ways to think about the same data, which is a real cost. The win is that templates lose the `(observable \| async) as alias` ceremony and the "no pipe in action expression" parser-error workaround. |
| "Was there a moment you got it wrong?" | Yes — I initially used `@if (X; as alias)` on `@else if` branches, which Angular's compiler rejects. Switching to `toSignal()` made the alias unnecessary because `items()` is a synchronous read I can call as many times as I want. That's documented in the [NgRx Guide doc](./NGRX_GUIDE.md). |

---

## 4. Q3 — What measurable outcome did the project achieve?

### The answer (60–90 seconds spoken)

> Every requirement in the assignment spec plus all three listed bonus items shipped. Test coverage spans 4 frontend unit-test files (reducer, effect, service, form), Jest suites on the two highest-risk backend services (audit + employee), and 4 Cypress end-to-end flows covering employees, accounts, audit log, and filter composition. The app is responsive across 4 viewport tiers from 360px phones to 4K monitors, and the accessibility audit hits WCAG 2.1 AA on every interactive surface.

### Why this wording

"Measurable" in a take-home context is genuinely tricky — there are no production metrics. So I anchor on what *is* countable: spec coverage, test count, viewport range, WCAG level. Each of those is verifiable in 10 seconds by the interviewer.

The phrase **"plus all three listed bonus items"** is a flag: it tells the interviewer I didn't just hit the rubric, I extended it.

### If the interviewer pushes

| Follow-up | What to point to |
|---|---|
| "What are the three bonus items?" | Sort + pagination on the employee list, an append-only audit log per employee, and Cypress end-to-end coverage for the main flows. All called out in the spec PDF and shipped. |
| "What's the highest-risk untested code now?" | The validators (`name-format`, `no-whitespace`, `decimal-places`) have zero unit tests on the frontend, and the controllers + middleware have no Jest coverage. I flagged this explicitly in the [test-coverage write-up](../README.md#run-the-tests) so it doesn't surprise anyone. |
| "How do you know it's WCAG AA?" | Manual keyboard + screen-reader walk-throughs documented in [docs/ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md), plus a per-criterion mapping table. I haven't run a paid axe-core compliance scan, so "I think it hits AA" is honest — the rigorous claim would need a third-party audit. |
| "What would you measure in production?" | Time-to-first-meaningful-paint, p95 list-fetch latency, audit-log read latency, error-rate per endpoint, and a "tasks completed per session" funnel for the admin. None of those exist yet because the backend is in-memory. |

---

## 5. Q4 — What's the biggest thing you'd change?

### The answer (60–90 seconds spoken)

> I'd consolidate the validation rules into a shared package. Today the name regex, balance limits, and account-number pattern live in TypeScript on the client and JavaScript on the server, hand-copied — change one without the other and the user types something valid client-side and gets a 400 back. The fix is a tiny `packages/shared/` workspace both sides depend on, so changing a constraint changes both client UX and server enforcement in one PR.

### Why this wording

I deliberately pick a **specific, codebase-level concern** rather than the generic "add authentication". Auth is what every junior says. Validation drift is a real risk I spotted in my own code — that's more interesting.

The "type something valid… get a 400" framing puts a user behind the problem. The fix is concrete and easy to picture (a monorepo workspace).

### If the interviewer pushes

| Follow-up | What to point to |
|---|---|
| "Show me where the duplication is." | `client/src/app/core/validators/name-format.validator.ts` has `/^\p{L}[\p{L} \-']*$/u`, `server/validators/common.js` has the exact same regex. Same story for `MAX_BALANCE` in `client/src/app/features/accounts/components/account-form/account-form.component.ts` and `server/config/index.js`. |
| "What does the shared package look like?" | A `packages/shared-validation/` workspace exporting plain constants (`NAME_PATTERN`, `MAX_BALANCE`, `ACCOUNT_NUMBER_PATTERN`) and pure-function validators. Client imports them into Angular validators; server imports them into Express validators. Both sides build from one truth. |
| "Anything else high on the list?" | Authentication — `actor: 'admin'` is hard-coded everywhere, which makes the audit log technically working but functionally meaningless. A JWT middleware that populates `req.user` and a small login form would unblock all the per-user audit-attribution work. I called this out in the [senior-dev review](../README.md). |
| "Why not auth first?" | Auth is an obvious gap that needs business decisions (SSO? SAML? OIDC? which provider?). Validation drift is a silent bug I can fix with pure engineering judgement, no business call required. |

---

## 6. Q5 — What did you learn that changed how you build software?

### The answer (60–90 seconds spoken)

> Good architecture is mostly about putting each piece of code at the right layer, not making it work. The refactor that drove this home was splitting the model layer into pure-CRUD repositories and business-rule services — the cascade-close-on-delete logic moved layers without changing a single line, and suddenly it was testable in isolation against a stubbed repository. I came away thinking "where does this code belong" is the senior question, not "how do I make it work".

### Why this wording

This is the lesson I most genuinely internalized building this project. Phrasing it as **"not making it work"** is provocative and memorable — it forces the interviewer to engage with the claim instead of nodding along.

Tying it to a specific refactor (repository + service split) shows the lesson came from doing the work, not from reading a blog.

### If the interviewer pushes

| Follow-up | What to point to |
|---|---|
| "Walk me through that refactor." | Originally the cascade logic lived in `EmployeeModel.remove()` — both the data access AND the business rule were in one place. The split moved pure CRUD (`deleteById`, `updateAllByEmployeeId`) into `EmployeeRepository`, and the orchestration ("find OPEN accounts, delete employee, close those accounts, record audit") stayed in `EmployeeService.remove()`. Same end-state, but the service can now be unit-tested against a stub repository. |
| "Where did you almost get this wrong?" | I initially put timestamp generation in the repository ("the store needs `updatedAt` set"). Then I realized timestamps are a business rule — "every write stamps a time" — not a storage concern. Moving them to the service unblocked the testability story because now I can write a test that bypasses timestamps if it wants to. |
| "Any other example?" | The MAX_PAGE_SIZE clamp from the security pass. The temptation was to put it in the controller ("HTTP-layer concern"). But a CLI script or scheduled job calling the same service should also be clamped — the rule belongs to the service. Documented in [docs/MAX_PAGE_SIZE_CLAMP.md](./MAX_PAGE_SIZE_CLAMP.md). |
| "How do you apply this to new work?" | When I see a new feature, I now sketch the layering before I write code: which layer owns the rule, which layer owns the data access, which layer owns the HTTP shape. Five minutes upfront saves an hour of refactor later. |

---

## 7. How to use this document

1. **The week before the interview.** Read each section out loud once. Time yourself — each spoken answer should land at 60–90 seconds. If you're going over, trim. If under, you might be too terse to give the interviewer hooks.
2. **The morning of.** Re-read just the [TL;DR](#1-tldr--the-five-answers-in-one-screen). Don't try to memorize verbatim — internalize the *structure* of each answer (the topic, the trade-off you considered, the specific file you'd point at). Verbatim memorization makes you sound rehearsed.
3. **During the interview.** Lead with the short answer (the 2–3 sentence version). Pause. If the interviewer follows up, the "if pushed" table is your reference for which file to mention next.
4. **Avoid.** Reading from the document during the call. Reading from notes during a live interview is the single fastest way to lose senior signal.

---

## 8. Backup answers (if the interviewer goes deeper)

Sometimes the interviewer reframes the question and your primary answer doesn't land. Have a second option ready for each.

### Hardest decision — alternate

> A close runner-up was the audit-log design: do you store every write as a full snapshot, or as a field-level diff, or both? Different shapes for different actions — CREATE/DELETE snapshot, UPDATE diff, CLOSE/REOPEN named narrative — meant the recording layer had six methods with subtle differences. Getting that right meant testing every variant explicitly, and it's the source of nearly half the Jest backend tests.

### Biggest change — alternate

> Adding real authentication. Right now `actor: 'admin'` is hard-coded in every audit entry, which means the audit log technically works but functionally tells you nothing. A JWT middleware populating `req.user` and a login form would unblock per-user attribution everywhere — about a day of work to scaffold.

### What you learned — alternate

> Accessibility isn't a separate workstream — it's a series of small, specific HTML attributes that tell assistive tech what your visual UI already says. `aria-describedby` says "read this error when this field is focused"; `aria-sort` says "this column is the active sort"; `aria-current="page"` says "you are here". Knowing *which* attribute applies *where* is what makes the work look senior. The code is rarely more than one line per fix.

---

## One paragraph to leave with

> The interview won't be a test of whether I built every feature perfectly — it's a test of whether I can talk about the work like someone who's lived inside it. These five answers are short on purpose: each one is a hook the interviewer can pull on, and each section above tells me what's at the end of the rope.

---

## See also

- **[INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md)** — the full ten-step preparation: two-minute pitch, ASCII architecture diagram, decision-tree with rejected alternatives, anti-patterns specific to this project, role-tailoring matrix, and the day-of checklist.
- **[NGRX_GUIDE.md](../NGRX_GUIDE.md)** — when an interviewer asks me to walk through the state-management story end to end.
- **[ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md)** — when an interviewer asks "what does WCAG 2.1 AA mean for you, concretely?".
- **[MAX_PAGE_SIZE_CLAMP.md](./MAX_PAGE_SIZE_CLAMP.md)** — when an interviewer asks for an example of pragmatic security hardening I shipped.
- **[../README.md#10-senior-dev-review-whats-missing](../README.md#10-senior-dev-review-whats-missing)** — my self-review of the gaps that remain, in case the interviewer asks "what would you change?" and I want to go past the prepared answer.

---

*Banking Admin Portal — interview preparation.*
