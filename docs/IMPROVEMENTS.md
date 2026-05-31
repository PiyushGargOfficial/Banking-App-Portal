# Banking App Portal — Improvement Review

> A prioritized, senior-level review of the codebase. The headline: **the architecture is genuinely strong** (layered backend, NgRx + facade, signals-at-the-leaf, audit trail, problem-details, correlation IDs). What separates this from a "senior" submission isn't the app design — it's the **engineering envelope around it**: tooling, CI, test breadth, and production hardening. That's where the cheap, high-impact wins are.

---

## Tier 1 — Highest impact, lowest effort (do these first)

1. **No CI pipeline.** There's no `.github/workflows/`. For a senior submission this is the #1 missing signal — it says "I don't gate merges on tests." A single `ci.yml` running `test:all` + `build` + lint on every push is ~30 min and changes the whole impression.

2. **No linting/formatting at all.** No ESLint, Prettier, or EditorConfig anywhere. A "production-ready" codebase that can't `npm run lint` is the first thing an interviewer probes. Add `angular-eslint` (client) + `eslint` (server) + Prettier + a `lint` script.

3. **README is factually wrong.** [README.md:56](../README.md#L56) says _"Seeded with 3 employees + 3 accounts"_ but [seed.js:3](../server/data/seed.js#L3) and README:193 both say **33 employees + 12 accounts**. Verified — seed is 33/12. An interviewer catches this in 2 minutes; fix it.

4. **CORS allows all origins.** [app.js:30](../server/app.js#L30) — the comment _claims_ "allow the Angular dev server origin" but the code allows `*`. For a **banking** app this is the security smell reviewers love to point at. Drive `origin` from config/env.

5. **No graceful shutdown or process error handlers.** [server.js](../server/server.js) is just `app.listen`. No `SIGTERM` drain, no `unhandledRejection`/`uncaughtException` handler. Trivial to add and signals you've run Node in a container.

---

## Tier 2 — Test breadth (the strongest area to deepen)

Existing tests are high quality; the gap is **breadth**, and the asymmetry is glaring:

- **`account.service.js` has zero tests** while `employee.service.js` is tested end-to-end. Accounts are where the money/state transitions live (close/reopen idempotency, balance, cascade). Single most conspicuous coverage gap.
- **All server validators untested** (`employee.validator`, `account.validator`, `common.js`) — and they're listed in `collectCoverageFrom`, so coverage reports already show the hole.
- **No controller/HTTP-boundary tests.** Add `supertest` smoke tests asserting 201/400/404/409 + problem-details shape. ~1 file, big confidence payoff.
- **Frontend: only 1 of ~15 components tested**, and the entire `accounts` NgRx slice (reducer/effects/selectors) has no specs even though the `employees` slice does — just mirror the existing pattern.
- **No coverage thresholds** in Jest/Karma — so coverage is a vanity number, not a gate.

Closing `account.service` + validators + one supertest controller file would erase the "tests are incomplete" critique. You don't need 100%.

---

## Tier 3 — Real code-level findings (verified)

6. **Subscription not torn down** — [employee-audit-log.component.ts:69](../client/src/app/features/employees/components/employee-audit-log/employee-audit-log.component.ts#L69). `this.api.listForEmployee().subscribe(...)` has no `takeUntilDestroyed()`. When the parent swaps `employeeId` rapidly (its `ngOnChanges` re-calls `load()`), a slow/stale response can land out of order. Inject `DestroyRef` and pipe `takeUntilDestroyed(this.destroyRef)`. Low severity, but exactly the kind of RxJS-hygiene detail seniors are expected to catch.

7. **No max page size** — [employee.service.js](../server/services/employee.service.js) / [audit.service.js](../server/services/audit.service.js). `?size=999999999` is honored. Clamp with a `MAX_PAGE_SIZE`. Cheap DoS-hardening talking point.

8. **Model logging is info-level PII.** Logging full employee/account models (email, balance) to stdout on every write is fine for a demo but worth gating behind `LOG_LEVEL=debug` — and it's a great thing to _call out yourself_ in the README as a conscious trade-off. Self-awareness reads as senior.

9. **`Validators.email` + naive HTML-strip sanitizer.** [sanitize.js](../server/utils/sanitize.js) regex-strips tags only. It's adequate as defense-in-depth, but a one-line comment stating "display-context tag-stripping only, not XSS-complete; output is encoded by Angular" shows you understand the boundary rather than over-trusting it.

---

## Tier 4 — Polish (nice-to-have, mention don't over-invest)

- **TypeScript:** add `noUnusedLocals` / `noUnusedParameters` to `tsconfig.json` (strict is on, but these aren't).
- **angular.json budgets** are warnings, not errors — tighten `maximumError` so bundle bloat fails the build.
- **Health check endpoint** (`GET /health`) for probes.
- **Dockerfile + compose** — signals deployment awareness.
- **Confirm-dialog focus trap** — `role="dialog"` is set but no focus management/restore. A11y matters extra for banking.

---

## What I'd actually do to "impress"

If the goal is interview signal per hour invested, the ranking is clear:

1. **CI + ESLint/Prettier** (Tier 1)
2. **README fix + CORS + graceful shutdown** (Tier 1)
3. **`account.service` tests + one supertest file** (Tier 2)

That converts "good app, junior envelope" into "senior submission" in roughly half a day. The deep component-test backfill and Docker are lower marginal return.
