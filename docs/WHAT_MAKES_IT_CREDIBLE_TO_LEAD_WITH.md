# 2. What Makes It Credible to Lead With

> A detailed expansion of the four-row table in
> [INTERVIEW_PLAYBOOK.md §2](./INTERVIEW_PLAYBOOK.md#2-why-this-project-is-the-right-one-to-showcase).
> A take-home is small by definition — so *why* is it credible to open a senior
> interview with? Because senior interviews don't grade size; they grade
> **judgment**. This doc unpacks the four kinds of judgment this project lets you
> demonstrate, with the specifics, the file to point at, and the sentence to say.

The table being expanded:

| The senior interview wants to see | This project demonstrates |
|---|---|
| Real trade-offs you made | NgRx vs Signals split, clamp vs reject for `MAX_PAGE_SIZE`, MVC vs single-file Express, soft-delete vs hard-delete cascade |
| Problems you solved on your own | Output-alias compile error, parser-error around pipes in actions, focus-management gap in the confirm dialog, validation drift risk |
| Outcomes you can point to | Spec compliance, test counts, viewport tiers, WCAG level |
| Architectural ownership | Folder layout, layering, repository pattern, audit-log shape, testing strategy — all your calls |

---

## Table of contents

1. [Why "credible to lead with" is the real bar](#1-why-credible-to-lead-with-is-the-real-bar)
2. [Real trade-offs you made](#2-real-trade-offs-you-made)
3. [Problems you solved on your own](#3-problems-you-solved-on-your-own)
4. [Outcomes you can point to](#4-outcomes-you-can-point-to)
5. [Architectural ownership](#5-architectural-ownership)
6. [How to weave these into the opening two minutes](#6-how-to-weave-these-into-the-opening-two-minutes)

---

## 1. Why "credible to lead with" is the real bar

A junior describes **what a project has** ("it has CRUD, NgRx, Cypress"). A senior
describes **what they decided and why**. The same project can read as either,
depending on how you frame it.

"Credible to lead with" means: the very first thing you say survives a sceptical
follow-up. If you open with "I built a full-stack app," the natural reply is "so
did every other candidate." If you open with "I made four architectural
trade-offs I can defend, solved four problems with no one to ask, and wrote my own
senior-level review of the gaps," there's no deflating follow-up — every clause
invites a deeper question you're ready for.

The four rows below are the four *evidence types* that make the opener
sceptic-proof.

---

## 2. Real trade-offs you made

A trade-off is only senior-credible if you can name **what you gave up**. "I used
NgRx" is a choice; "I used NgRx *and* Signals, accepting X to gain Y, rejecting
Z" is a trade-off. Four to have loaded:

### 2a. NgRx vs Signals — and why *both*

**The decision:** NgRx stays the single source of truth; Signals appear at three
specific seams (`toSignal()` bridging facade observables, `signal()` for
component-local UI state, `effect()` for state-driven DOM side effects).

**What you gave up / why it's credible:** the easy answers were "NgRx everywhere"
(template ceremony forever, `(obs | async)` everywhere) or "Signals only / drop
NgRx" (lose Redux DevTools time-travel, diverge from what most Angular shops run).
You chose a *boundary* instead of a religion — and can name exactly where the
boundary sits and why. That "I didn't replace NgRx with Signals, I bolted them on
at the leaf" line is the senior tell.

**Point at:** the "Signals at the leaf" table in the
[README §6](../README.md#6-architecture); `EmployeeDetailComponent`'s `effect()`
for the document-title sync.

**Say:** *"NgRx is the source of truth; Signals show up at three seams where
they're objectively the right tool, not sprinkled everywhere."*

### 2b. Clamp vs reject for `MAX_PAGE_SIZE`

**The decision:** `?size=999999` is silently **clamped** to 100 (the
`MAX_PAGE_SIZE` constant in `config/index.js`), and the clamped value is echoed
back in the response envelope — rather than returning `400 Bad Request`.

**What you gave up / why it's credible:** rejecting is the "cleaner contract"
answer and many candidates reach for it reflexively. You can articulate *why you
didn't*: for an internal admin tool with one known client (our own UI), graceful
degradation beats breaking a caller that didn't know the limit — while still
killing the DoS vector of an unbounded response. Naming the *security reason*
(bounded payloads) **and** the *UX reason* (don't break existing callers) for one
small `Math.min()` is disproportionately senior.

**Point at:** [docs/MAX_PAGE_SIZE_CLAMP.md](./MAX_PAGE_SIZE_CLAMP.md) — including the
four-test pattern that proves the clamp works without breaking the normal path.

**Say:** *"I clamp instead of reject because there's one known client; the clamp
bounds the payload for safety without breaking a caller who didn't know the
ceiling."*

### 2c. MVC + repository + service vs single-file Express

**The decision:** the backend is a strict layered stack (routes → controllers →
services → repositories → store), not the typical one-file `server.js`.

**What you gave up / why it's credible:** the single file is faster to write —
that's the cost you paid (≈18 files instead of one). The win you bought:
business rules (cascade-soft-close on delete, audit recording) are unit-testable
against a stub repository **without** an HTTP server, and the store is swappable
to Postgres by touching only the repository layer. You can name the *third place*
problem: where would the audit-diff logic live in a single file? Either polluting
the controller (HTTP) or the store (data access) — there's no coherent home. The
service layer *is* the home.

**Point at:** `server/services/employee.service.js` `remove()` — one cohesive,
transaction-shaped function orchestrating two repositories and the audit service;
its Jest suite proves the cascade without booting Express.

**Say:** *"I paid ~18 files instead of one so the business rules are testable in
isolation and the storage engine is swappable."*

### 2d. Soft-delete vs hard-delete (and the cascade)

**The decision:** deleting an **account** is a *soft close* (`status → CLOSED`);
deleting an **employee** is a hard delete that **cascade-soft-closes** their open
accounts — and audit entries persist even after the employee row is gone.

**What you gave up / why it's credible:** the naive answer is "delete the row."
You can explain why that's wrong *for a bank*: hard-deleting everything destroys
audit history (useless for compliance); soft-deleting *everything* (including
employees) bloats every list query with "exclude deactivated" filters. The chosen
asymmetry — soft where history matters operationally (accounts), hard-with-cascade
where the entity is truly gone but its trail must survive (employees) — is a
domain-aware call, not a default.

**Point at:** the cascade in `employee.service.js` `remove()` and its test
(`employee.service.test.js`).

**Say:** *"Accounts soft-close so balances/history survive; employees hard-delete
but cascade a soft-close and the audit trail outlives the row — that's the
compliance-shaped choice."*

> Deeper versions of all four live in
> [INTERVIEW_PLAYBOOK.md §5 — the decision tree](./INTERVIEW_PLAYBOOK.md#5-decision-tree--why-this-over-the-alternatives),
> which also lists the *rejected* alternatives in full.

---

## 3. Problems you solved on your own

This row is the one juniors skip — and it's the strongest signal in the set. On a
team you have PR review and a senior to ask. On a solo take-home there's **no one**.
Naming bugs you hit and resolved alone proves you can operate without a safety net.
Four war-stories:

### 3a. The output-alias compile error

**What broke:** the confirm-dialog originally aliased its output —
`@Output('confirm') confirmed` — so consumers could write the conventional
`(confirm)="..."` while avoiding the name `confirm` shadowing `window.confirm`
inside the component. Angular's **strict template compiler** refused to resolve
the alias at the consumer site.

**How you solved it:** renamed the outputs to past-tense `confirmed` / `cancelled`
(which the Angular style guide recommends anyway) and updated the consumer
templates. The lesson you can articulate: *output aliases are fragile under
`strictTemplates`; the idiomatic name was the right answer sitting there the whole
time.*

**Point at:** the dialog is consumed with `(confirmed)` / `(cancelled)` in
`employee-detail.component.html` today — the resolved end-state.

### 3b. The parser-error around pipes in `(click)` actions

**What broke:** after moving off `(obs | async)`, a pagination button used
`(click)="onPage(-1, ((totalPages$ | async) ?? 1))"`. Angular's expression parser
**silently rejects pipes inside action expressions** — and points the error at the
*next* expression, sending you on a wild goose chase.

**How you solved it:** rather than the local fix (wrap the footer in
`@if ((totalPages$ | async) ?? 1; as totalPages)`), you migrated the component to
Signals so `totalPages()` is a synchronous read — fixing the immediate bug *and*
cleaning the rest of the template. The lesson: *sometimes the right fix is broader
than the bug.*

### 3c. The focus-management gap in the confirm dialog

**What broke / the gap:** a modal that doesn't trap focus, doesn't return focus on
close, and doesn't handle Escape is invisible to keyboard and screen-reader users
— easy to ship without noticing because it looks fine with a mouse.

**How you solved it:** implemented the WAI-ARIA modal pattern by hand —
`role="dialog"`, `aria-modal`, focus moves to the dialog on open, Escape closes,
and focus **returns** to the trigger. You can defend *why hand-rolled instead of
`@angular/cdk/dialog`*: in a real product the CDK is right; here, rolling it makes
the ARIA pattern visible in the code (and you flag the CDK as the production
choice — see §3d/README §10).

**Point at:** [docs/ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md) (dialog
focus-management section); the live demo "delete → Escape returns focus" moment.

### 3d. The validation-drift risk (a problem you *named* before it bit)

**What it is:** the name regex, `MAX_BALANCE`, and the account-number pattern exist
in **both** `client/src/app/core/validators/` and `server/validators/common.js`. A
one-sided edit would silently diverge what the UI accepts from what the API
rejects.

**Why naming it is the senior move:** you didn't just *have* the duplication — you
**identified it as a risk** and documented the fix (a shared package both depend
on) in your own self-review. Spotting a latent contract-drift bug before it fires
is exactly what a senior does in review.

**Point at:** [README §10 — Senior-dev review](../README.md#10-senior-dev-review-whats-missing),
item 3.

> The full versions, including the messy bits, are in
> [INTERVIEW_PLAYBOOK.md §7 — the messy parts](./INTERVIEW_PLAYBOOK.md#7-the-messy-parts-what-didnt-work).

---

## 4. Outcomes you can point to

There are no production metrics (no users, no uptime). The credibility here comes
from **honest, specific, right-sized numbers** — and from naming what you
*don't* measure.

| Outcome | The number | The framing that makes it senior |
|---|---|---|
| **Spec compliance** | 100% of required features + all 3 bonus items | "I treated the spec as the floor, not the ceiling." |
| **Test counts** | 4 frontend unit specs (reducer/effect/service/form) · 2 backend Jest suites · 4 Cypress e2e flows | "Coverage is *concentrated on the two services where a regression silently corrupts data* — not spread thin for a vanity number." |
| **Viewport tiers** | One responsive system spanning phone (≤480) → tablet (≤768/1024) → desktop → 4K | "Tables drop columns and the container scales at specific widths — not just `max-width: 100%`." |
| **Accessibility** | WCAG 2.1 AA on interactive surfaces (audit documented) | "I did an actual a11y pass — focus management, ARIA, contrast — and wrote down what each change announces to a screen reader." |

**The discipline that reads as senior:** state what you *don't* claim. No
production latency (no production), no bundle-size number (no analyzer pass run),
no user-satisfaction (no users). Saying *"I don't have hard production numbers
because the brief is take-home-shaped"* is more credible than inventing them.

**Say:** *"30-ish tests, deliberately on the riskiest code — the audit diff and
the cascade delete — rather than spread thin for a coverage percentage."*

> The full numbers (responsive tiers, file counts, WCAG criteria) are in
> [INTERVIEW_PLAYBOOK.md §6](./INTERVIEW_PLAYBOOK.md#6-quantified-impact--the-honest-numbers).

---

## 5. Architectural ownership

On a team, much of the structure is "the convention I inherited." Here, **nothing
is inherited** — you chose every layer. That's a rare, clean thing to be able to
say, and it's true:

| You owned | The specific decision |
|---|---|
| **Folder layout** | `core` / `shared` / `features` on the client; the layered `server/` tree |
| **Layering** | The one-way dependency rule `controller → service → repository → store`, with the explicit "controller importing a repository is the smell" guardrail |
| **Repository pattern** | Splitting "model" into pure-CRUD repository + business-rule service so the store is swappable and rules are testable |
| **Audit-log shape** | Per-action design: snapshot for CREATE/DELETE, field-level diff for UPDATE, named narrative for CLOSE/REOPEN — *you* decided what each entry stores |
| **Testing strategy** | Risk-based: unit-test the two highest-blast-radius services, e2e the four highest-traffic flows, accept the validator/controller gap *consciously* |

**Why this is credible to lead with:** ownership claims are easy to *make* and hard
to *defend* — unless they're true. Here, an interviewer can ask "why is the audit
diff shaped that way?" or "why repository *and* service?" and you have a real
answer for every one, because you made every one. There's no "I'm not sure, that's
just how our codebase did it."

**The honesty that strengthens it:** pair the ownership with the self-review.
*"I owned the structure top to bottom — which is also why I wrote my own
senior-dev review of the gaps, since there was no second reviewer."* That converts
"solo project" from a limitation into evidence of ownership.

> See [README §10](../README.md#10-senior-dev-review-whats-missing) for the
> self-review, and [INTERVIEW_PLAYBOOK.md §8](./INTERVIEW_PLAYBOOK.md#8-ownership-beyond-code)
> for the ownership-beyond-code framing.

---

## 6. How to weave these into the opening two minutes

You don't recite this table — you *thread* it through the pitch:

> *"It's a take-home, but I treated it as a real product. I made a few trade-offs
> I can defend — NgRx with Signals only at the leaf, clamp-not-reject on page size,
> a layered backend so business rules are testable. I solved the problems solo —
> a strict-template alias bug, a parser quirk with pipes in actions, the dialog
> focus-management pattern by hand. The outcomes are honest: every required
> feature plus all three bonuses, tests concentrated on the two services where a
> bug would silently corrupt data, WCAG AA on the interactive surfaces. And I
> owned the whole structure — which is why I also wrote my own review of the gaps
> that remain."*

Each clause is a door. The interviewer walks through whichever one interests them,
and the detailed sections above are what's behind each door.

**The meta-point:** the project being small is irrelevant. What's credible to lead
with is the *thinking* — four defensible trade-offs, four solo fixes, honest
numbers, and total ownership including the gaps. That's what a take-home, framed
this way, lets you prove.

---

*See also: [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md) (the full ten-step
prep), [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) (the demo delivery),
[HOW_WOULD_YOU_SCALE_THIS_10X.md](./HOW_WOULD_YOU_SCALE_THIS_10X.md), and the
[README self-review](../README.md#10-senior-dev-review-whats-missing).*
