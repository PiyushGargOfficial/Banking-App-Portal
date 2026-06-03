# Problems I Solved on My Own — In Terms of This Project

> A detailed expansion of the **"Problems you solved on your own"** row from
> [INTERVIEW_PLAYBOOK.md §2](./INTERVIEW_PLAYBOOK.md#2-why-this-project-is-the-right-one-to-showcase)
> and [WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md §3](./WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md#3-problems-you-solved-on-your-own).
> Each of the four problems is traced to the **actual file and code** in this
> project — the symptom, the root cause, the fix, and what it signals.

**Why this row carries weight.** On a team, a second pair of eyes catches your
blind spots in code review. On a solo take-home there's **no one** — so every bug
below was diagnosed and resolved without help. Naming them (with the file you can
open) proves you can operate without a safety net, which is exactly what the
absence of a reviewer tests.

The four:

| # | Problem | Where it lives now |
|---|---|---|
| 1 | Output-alias compile error | [confirm-dialog.component.ts](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts) |
| 2 | Parser error — pipe inside a `(click)` action | [employee-list.component.ts](../client/src/app/features/employees/pages/employee-list/employee-list.component.ts) |
| 3 | Focus-management gap in the confirm dialog | [confirm-dialog.component.ts](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts) |
| 4 | Validation drift risk (client ↔ server) | [name-format.validator.ts](../client/src/app/core/validators/name-format.validator.ts) ↔ [common.js](../server/validators/common.js) |

---

## Table of contents

1. [Output-alias compile error](#1-output-alias-compile-error)
2. [Parser error — pipe inside a (click) action](#2-parser-error--pipe-inside-a-click-action)
3. [Focus-management gap in the confirm dialog](#3-focus-management-gap-in-the-confirm-dialog)
4. [Validation drift risk (client ↔ server)](#4-validation-drift-risk-client--server)
5. [What the set proves](#5-what-the-set-proves)

---

## 1. Output-alias compile error

### The symptom
The reusable confirmation modal needed to tell its host page "the user clicked
Confirm / Cancel." The natural binding name from the host's side is
`(confirm)="..."`. So the first version **aliased** the output — declaring it as
`@Output('confirm')` while the internal property had another name. Under Angular's
**strict template type-checker** (`strictTemplates: true`), the alias failed to
resolve at the consumer's template — a compile-time error, not a runtime one.

### The root cause
Two things collided:
- **Output aliases are fragile under `strictTemplates`** — the public alias and the
  class property diverging is exactly the kind of indirection the strict compiler
  is picky about.
- The name `confirm` is doubly loaded: it shadows the global **`window.confirm`**,
  and `cancel` collides with the **native `cancel` DOM event**.

### The fix (what's in the code now)
The outputs were renamed to **past-tense, un-aliased** names — which is also what
the Angular style guide recommends for event outputs. In
[confirm-dialog.component.ts:153-154](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L153-L154):

```ts
@Output() readonly confirmed = new EventEmitter<void>();
@Output() readonly cancelled = new EventEmitter<void>();
```

And the reasoning is documented right in the component header
([lines 33-36](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L33-L36)):

> *"Outputs use past-tense names (`confirmed` / `cancelled`) — this matches the
> Angular style guide for event names, avoids shadowing `window.confirm` and the
> native `cancel` DOM event, and keeps the strict template type-checker happy
> (output aliases can be flaky under strictTemplates)."*

Consumers bind the clean names, e.g. in the employee detail page:
`(confirmed)="confirmDelete(emp)"` / `(cancelled)="cancelDelete()"`.

### The lesson
*Clever indirection (aliases) loses to idiomatic naming.* The renames were cheap;
chasing a strict-compiler bug around an alias was not — and the style-guide answer
was sitting there the whole time. **Say:** *"Output aliases are flaky under strict
templates, so I used the past-tense names the style guide recommends anyway."*

---

## 2. Parser error — pipe inside a `(click)` action

### The symptom
The employee-list pagination buttons needed the current `totalPages` to clamp the
page number. The first attempt read it straight in the template action:

```html
<!-- the version that broke -->
<button (click)="onPage(-1, ((totalPages$ | async) ?? 1))">Prev</button>
```

This produced a **template parser error** — and the maddening part: Angular's
expression parser **silently rejects pipes inside action (event) expressions**,
and the error message pointed at the *next* expression in the template, sending
the debugging off in the wrong direction.

### The root cause
Pipes are allowed in *binding* expressions (`[x]="a | b"`, `{{ a | b }}`) but
**not in action expressions** (`(click)="..."`). The parser treats `|` in an
action context as invalid, and its error positioning is unhelpful.

### The fix (what's in the code now)
Rather than the local patch (wrapping the footer in `@if ((totalPages$ | async) ?? 1; as totalPages)`),
the component was migrated to **Signals**, so `totalPages` is a **synchronous
read** — no pipe, no async, no wrapper. The handler takes it as a plain number
([employee-list.component.ts:121-127](../client/src/app/features/employees/pages/employee-list/employee-list.component.ts#L121-L127)):

```ts
onPage(delta: number, totalPages: number): void {
  const current = this.query().page ?? 1;
  const next = Math.max(1, Math.min(totalPages, current + delta));
  if (next === current) return;
  this.query.update((q) => ({ ...q, page: next }));
  this.facade.loadList(this.query());
}
```

The template now calls `onPage(-1, totalPages())` — reading the signal directly
(no pipe). The same migration cleaned up the rest of the template (`items()`,
`loading()`), which ties straight into the project's "Signals at the leaf"
decision.

### The lesson
*Sometimes the right fix is broader than the bug.* The local workaround would
have worked; migrating to a signal fixed the immediate parser error **and** removed
the async-pipe ceremony across the whole template. **Say:** *"Pipes aren't allowed
in action expressions; I fixed it by reading the value as a signal, which also
made the template cleaner."*

---

## 3. Focus-management gap in the confirm dialog

### The symptom
A modal that looks fine with a mouse can be **completely broken for keyboard and
screen-reader users**: focus doesn't move into it on open, Tab escapes to the page
behind it, Escape does nothing, and on close focus is lost (dumped to `<body>`).
None of this is visible in a quick mouse-driven demo — which is exactly why it's
easy to ship.

### The root cause
The confirm dialog is **hand-rolled** (not `@angular/cdk/dialog`), so none of the
WAI-ARIA modal behaviours come for free — they each had to be implemented
deliberately.

### The fix (what's in the code now)
[confirm-dialog.component.ts](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts)
implements the full WAI-ARIA `dialog` pattern:

- **Announce as a modal:** `role="dialog"`, `aria-modal="true"`, and
  `aria-labelledby` pointing at the title (template lines 76-82).
- **Capture the trigger before render** ([L183](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L183)):
  ```ts
  this.previouslyFocused = document.activeElement as HTMLElement | null;
  ```
- **Move focus into the dialog — onto Cancel, deliberately** so an accidental
  Enter can't confirm a destructive delete ([ngAfterViewChecked, L196-204](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L196-L204)). It's done in `ngAfterViewChecked` because the `@ViewChild` button doesn't exist until after the template renders.
- **Escape closes** ([@HostListener, L207-212](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L207-L212)).
- **Focus trap** — Tab / Shift+Tab wrap within the dialog so the keyboard can't
  reach the page behind it ([onKeydown, L223-243](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L223-L243)).
- **Return focus to the trigger on close** so the user lands back on the Delete /
  Close button they came from ([L188-192](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts#L188-L192)).

### The lesson
*Accessibility is invisible until you test without a mouse.* Defending the
hand-rolled choice is part of the answer: in a real product `@angular/cdk/dialog`
is correct, but rolling it by hand makes the ARIA pattern **visible in the code**
(and it's flagged as the production swap in the [README self-review](../README.md#10-senior-dev-review-whats-missing)).
**Say (and show live):** *"Open the delete dialog, press Escape — it closes and
focus returns to the exact Delete button I came from."*

---

## 4. Validation drift risk (client ↔ server)

### The symptom
This one isn't a crash — it's a **latent bug I identified before it fired.** The
same validation rules are written **twice**: once in the Angular validators and
once in the Express validators. If someone edits one side and not the other, the
UI and the API silently disagree about what's valid — the worst kind of bug,
because nothing errors; data just slips through one layer and bounces off the
other.

### The root cause — the literal duplication
The name pattern is **byte-for-byte identical** in two files:

- Client — [name-format.validator.ts:15](../client/src/app/core/validators/name-format.validator.ts#L15):
  ```ts
  const NAME_PATTERN = /^\p{L}[\p{L} \-']*$/u;
  ```
- Server — [common.js:11](../server/validators/common.js#L11):
  ```js
  const NAME_PATTERN = /^\p{L}[\p{L} \-']*$/u;
  ```

The same duplication exists for the **balance** rule (`/^\d+(\.\d{1,2})?$/` plus
the `MAX_BALANCE` cap) and the **account-number** pattern (`/^\d{8,19}$/`) — each
appears in both the client form validators and `server/validators/`.

### The fix — named, prioritised, not yet shipped
The honest part: this is documented as a **known gap**, not silently left. It's
**item 3 (Critical)** in the [README senior-dev review](../README.md#10-senior-dev-review-whats-missing),
with the fix spelled out — extract the shared rules into one package both sides
import, so a single edit can't drift the contract.

### The lesson
*Spotting a latent contract-drift bug before it bites is what a senior does in
review.* The credibility here isn't "I fixed it" — it's "I **found** it, named it
as Critical, and wrote down the fix." **Say:** *"The name regex, balance cap and
account-number pattern are duplicated client and server — a one-sided edit would
drift the contract silently, so I flagged it as the first thing I'd consolidate
into a shared package."*

---

## 5. What the set proves

Four problems, four different muscles — and together they tell the story the
"solo, no safety net" framing needs:

| Problem | The muscle it shows |
|---|---|
| Output-alias error | Knowing the framework's sharp edges + preferring idiom over cleverness |
| Pipe-in-action parser error | Reading misleading errors, and choosing the broader fix |
| Dialog focus management | Caring about the users you can't see (keyboard / screen reader) |
| Validation drift | Reviewing your *own* code critically — finding the bug before it fires |

The throughline: **there was no reviewer, so I became one.** Every fix above was
diagnosed alone, and the one that couldn't be fully fixed in scope (drift) was
caught, ranked, and documented. That's the difference between "I built it" and
"I own it."

---

*See also: [WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md](./WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md)
(the four evidence types), [INTERVIEW_PLAYBOOK.md §7](./INTERVIEW_PLAYBOOK.md#7-the-messy-parts-what-didnt-work)
(the messy parts in narrative form), [ACCESSIBILITY_AUDIT.md](./ACCESSIBILITY_AUDIT.md)
(the dialog pattern in full), and the
[README self-review](../README.md#10-senior-dev-review-whats-missing).*
