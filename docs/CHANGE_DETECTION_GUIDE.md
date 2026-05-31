# Change Detection — Are We Zoneless?

> A walkthrough for junior developers. Answers the question "does this project use
> zoneless change detection?" and explains what that means, with the exact files
> that prove it.

**Short answer: No.** This project is **not** zoneless. It uses the traditional
**Zone.js-based** change detection, with `eventCoalescing` turned on.

---

## Table of contents

1. [The evidence](#1-the-evidence)
2. [What change detection actually is](#2-what-change-detection-actually-is)
3. [Zone.js vs zoneless](#3-zonejs-vs-zoneless)
4. [Why this matters: a signal-first codebase](#4-why-this-matters-a-signal-first-codebase)
5. [Glossary](#5-glossary)

---

## 1. The evidence

Three independent signals all confirm Zone.js is in use. Any one of them is
enough; together they're conclusive.

**1. The change-detection provider.**
[client/src/app/app.config.ts](../client/src/app/app.config.ts) calls:

```ts
provideZoneChangeDetection({ eventCoalescing: true })
```

This is the **Zone.js** provider. The zoneless API would instead be
`provideExperimentalZonelessChangeDetection()` (Angular 18+) or
`provideZonelessChangeDetection()` (stable, Angular 20+) — **neither appears
anywhere in the codebase.**

**2. The build polyfills.**
[client/angular.json](../client/angular.json) includes:

```json
"polyfills": ["zone.js"],                      // build
"polyfills": ["zone.js", "zone.js/testing"],   // tests
```

A zoneless app removes `zone.js` from polyfills entirely. It's still here.

**3. The dependency.**
[client/package.json](../client/package.json) still depends on:

```json
"zone.js": "~0.14.3"
```

---

## 2. What change detection actually is

**Change detection** is how Angular knows _when_ to re-check your components and
update the DOM to match your data.

Your component has data (properties, signals). The template renders that data.
When the data changes, the screen must update. Change detection is the machinery
that decides _when_ Angular goes looking for those changes and re-renders.

The question "zoneless or not" is really: **what triggers that check?**

---

## 3. Zone.js vs zoneless

### With Zone.js (what this project uses)

Zone.js is a library that **monkey-patches all the async browser APIs** —
`setTimeout`, `addEventListener`, `Promise`, `fetch` / `XHR`, and so on.

Whenever one of those async APIs fires (a click, an HTTP response, a timer),
Zone.js notifies Angular: _"something might have changed — run change
detection."_ Angular then re-checks the component tree and updates the DOM.

- **Pro:** fully automatic. You never have to manually tell Angular to update.
  This is the classic Angular default and "just works."
- **Con:** ships an extra polyfill (larger bundle), and Angular can end up
  checking more of the component tree than strictly necessary.

The `{ eventCoalescing: true }` option in our config is a performance tweak: if
several events fire in the same tick (e.g. a burst of DOM events), Angular
batches them into a **single** change-detection pass instead of one per event.

### Zoneless (what this project does NOT use)

In a zoneless app you **drop Zone.js entirely**. Angular no longer gets
automatic "something happened" notifications. Instead it relies on **explicit**
signals that state changed:

- `signal()` / `computed()` updates
- `OnPush` components calling `markForCheck()`
- the `async` pipe resolving

- **Pro:** smaller bundle (no Zone.js), and more predictable, finer-grained
  updates → better performance.
- **Con:** you must be disciplined — if you mutate state in a way Angular can't
  observe, the view won't update on its own.

---

## 4. Why this matters: a signal-first codebase

Even though we're Zone.js-based, the project is written in a **signal-first
style**. That's good practice today, and it would make a future migration to
zoneless relatively painless.

- Components widely use `ChangeDetectionStrategy.OnPush`.
- State flows through signals — `toSignal()`, `signal()`, `computed()` — e.g.
  [client/src/app/features/accounts/components/account-list/account-list.component.ts](../client/src/app/features/accounts/components/account-list/account-list.component.ts).

**The one place the Zone.js dependency leaks:**
[client/src/app/features/employees/pages/employee-form/employee-form.component.ts](../client/src/app/features/employees/pages/employee-form/employee-form.component.ts)
manually calls `cdr.markForCheck()` on `form.statusChanges`:

```ts
this.form.statusChanges
  .pipe(takeUntil(this.destroy$))
  .subscribe(() => this.cdr.markForCheck());
```

Why? The async unique-email validator resolves inside an HTTP callback. With an
`OnPush` component, that resolution (pending → valid/invalid) doesn't repaint the
view on its own, so the "checking availability…" hint and the submit button's
disabled state would otherwise freeze until an unrelated event triggered a check.
The manual `markForCheck()` nudges Angular to update.

In a fully zoneless world you'd lean on signals / `markForCheck()` like this
**everywhere by design**, rather than as an occasional workaround.

---

## 5. Glossary

| Term | Plain-English meaning |
|---|---|
| **Change detection** | Angular's process of checking components for changed data and updating the DOM. |
| **Zone.js** | A library that patches async browser APIs so Angular auto-runs change detection when anything async happens. |
| **Zoneless** | Running Angular without Zone.js; updates are driven explicitly by signals / `markForCheck()` instead. |
| **`provideZoneChangeDetection`** | The provider that wires up the classic Zone.js-based change detection (what we use). |
| **`eventCoalescing`** | Batches multiple events in the same tick into one change-detection pass. |
| **`OnPush`** | A change-detection strategy that only re-checks a component when its inputs/signals change or `markForCheck()` is called. |
| **`markForCheck()`** | Manually tells Angular "this OnPush component may have changed — check it on the next pass." |
| **Signal** | A reactive value (`signal()`, `computed()`, `toSignal()`) that Angular can track for changes natively. |

---

**Bottom line:** Zone.js change detection with `eventCoalescing` enabled — **not
zoneless**. The signal-first architecture means a zoneless migration would be
low-friction if ever desired.
