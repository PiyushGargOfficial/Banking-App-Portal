# Test Breadth Guide — closing the coverage gaps

> **Who this is for:** a developer new to this codebase who wants to understand
> what tests we added, _which tool tests which layer and why_, and how to run
> and extend them.

---

## 1. The 30-second version

The app already had a few high-quality tests, but they were **lopsided**:
`employee.service` was tested end-to-end while `account.service` had **zero**
tests; the validators were untested; there were no tests at the HTTP boundary;
and the `accounts` NgRx slice had no specs even though `employees` did.

We closed those gaps and added **coverage gates** so the numbers can't quietly
regress. We deliberately used **the right tool for each layer**:

| Layer being tested                          | Tool        | Why                                                         |
| ------------------------------------------- | ----------- | ----------------------------------------------------------- |
| Server business logic (`account.service`)   | **Jest**    | Pure Node modules — fast, no browser needed                 |
| Server validators                           | **Jest**    | Pure functions — ideal unit-test target                     |
| The HTTP API boundary (status codes, JSON)  | **Cypress** | `cy.request()` exercises the real running server over HTTP  |
| Frontend NgRx slice (reducer/select/effect) | **Karma**   | Matches the existing `employees` specs; runs in the browser |

Two commands run it all locally:

```bash
npm run test:all     # Jest (server) + Karma (client) unit tests
npm run e2e:api      # boots the server, runs the Cypress API tests, tears it down
```

---

## 2. Why "breadth" matters (the testing pyramid)

A common mental model is the **testing pyramid**:

```
        /\        few   end-to-end  (slow, whole system)
       /  \
      /----\      some  integration / HTTP boundary
     /      \
    /--------\    many  unit tests  (fast, one function)
```

The existing tests were good but missing whole slices. An interviewer reading
the repo immediately spots an asymmetry like _"`employee.service` is tested but
`account.service` isn't"_ — accounts are where the **money and state changes**
live (open / close / reopen / balance), so that was the most conspicuous hole.
The goal here wasn't 100% coverage; it was **removing the obvious gaps** so the
suite tells a coherent story.

---

## 3. Server unit tests (Jest)

These live in `server/__tests__/` and run with `npm --prefix server test`. They
follow the existing pattern exactly: a clean in-memory store per test (the
`resetStore()` helper), small fixture factories, and assertions on both the
returned value **and** the audit-log side effects.

### 3a. `account.service.test.js` (the big gap)

[server/\_\_tests\_\_/services/account.service.test.js](../server/__tests__/services/account.service.test.js)
covers every method, with the focus on the money/state rules:

- **`create`** applies the domain defaults — `status -> OPEN`, `balance -> 0`
  (and the subtle case: an explicit `balance: 0` is kept, not treated as
  "missing").
- **`close`** is a _soft_ close — it flips status to `CLOSED` but **never
  deletes the row**, and is idempotent (closing an already-closed account stays
  closed).
- **`patch`** picks the right audit narrative: a status-only flip to `CLOSED`
  records a **CLOSE** entry, back to `OPEN` records a **REOPEN**, and anything
  else falls back to a generic **UPDATE** diff.
- Missing-id paths return **`null`** (so the controller can map them to a 404),
  and the correlation id / actor are forwarded onto every audit entry.

### 3b. The validator tests

The validators were listed in Jest's `collectCoverageFrom`, so leaving them
untested showed up directly as a hole in the coverage report. Three files now
cover them:

- [common.test.js](../server/__tests__/validators/common.test.js) — the shared
  primitives. The **boundary cases** matter most here: the email 120-char
  limit, the `MAX_BALANCE` ceiling, the "at most 2 decimals" rule, and exact
  enum membership.
- [employee.validator.test.js](../server/__tests__/validators/employee.validator.test.js)
  — `validateCreate` / `validateReplace` / `validatePatch`, including the rule
  that **status is optional on create but required on replace**.
- [account.validator.test.js](../server/__tests__/validators/account.validator.test.js)
  — the 8–19 digit account-number pattern, **balance optional on create but
  required on replace**, and the one transforming validator (`validatePatch`
  coerces a valid balance string to a `Number`).

> **A real finding from writing these:** the name validator only allows Unicode
> _letters_ (`\p{L}`), which means names containing combining marks — like many
> Devanagari names (`कुमार`) — are currently **rejected**. We captured that as
> an explicit test documenting the limitation rather than pretending it works.
> That kind of honest "here's a known edge" is exactly what tests are for.

---

## 4. The HTTP boundary (Cypress API tests)

The recommendation was a "smoke test asserting 201 / 400 / 404 / 409 +
problem-details shape." We did this with **Cypress** rather than a Node test
runner, because Cypress's `cy.request()` is a clean way to drive the **real
running server** over HTTP and assert the response contract.

### Where it lives and how it's wired

- The spec: [client/cypress/api/http-boundary.api.cy.ts](../client/cypress/api/http-boundary.api.cy.ts)
- A **dedicated Cypress config**: [client/cypress.config.api.ts](../client/cypress.config.api.ts).
  Unlike the e2e config (which opens the Angular app on port 4200), this one
  points `baseUrl` straight at the **API on port 3000** and loads **no DOM
  support file** — these tests never touch a browser page, only HTTP.

### What it asserts

Each endpoint is checked for the right status code and, on errors, the shared
**RFC 7807 problem-details** envelope (`type` / `title` / `status` / `detail`,
plus `errors[]` on validation failures):

- `201` on a valid create (employee and account), with domain defaults applied
- `400` + field-level `errors[]` on an invalid body
- `404` + problem-details for unknown employees/accounts
- `409` on duplicate email / duplicate account number
- `204` (no body) on employee delete; `200` + `status: CLOSED` on account
  soft-close; reopen back to `OPEN`
- the `X-Correlation-Id` response header round-trip

Because the mock server keeps state in memory for its whole lifetime, every
test **creates its own resources with unique ids** (timestamp-based) so reruns
never collide — the same approach the existing e2e specs use.

### Running it: a "dedicated test server"

The API tests need the server running but **not** the Angular app. We use
[`start-server-and-test`](https://github.com/bahmutov/start-server-and-test) to
orchestrate that in one command:

```bash
npm run e2e:api
```

That script (in the root `package.json`) does three things in order:

1. boots the Express mock API (`npm run start:server`),
2. waits until `http://localhost:3000/api/employees` answers,
3. runs the Cypress API specs, then **shuts the server back down**.

The same command runs in CI as a dedicated **"API tests (Cypress)"** job (see
[.github/workflows/ci.yml](../.github/workflows/ci.yml)) — so a developer and
the pipeline run the _identical_ flow.

> **Note on this repo's setup:** the Cypress _binary_ (a separate ~hundreds-of-MB
> download from the npm package) needs to unzip into a local cache. In the
> sandbox these tests were authored in, that unzip step was blocked, so the
> Cypress runner couldn't launch here. To still prove the specs are correct, the
> exact contract they assert (every status code + the problem-details shape) was
> verified by hitting the real server directly over HTTP. On a normal machine /
> in CI, `npm run e2e:api` runs the Cypress specs for real.

---

## 5. Frontend NgRx slice tests (Karma)

The `employees` store had reducer + effects specs; the `accounts` store had
none. We mirrored the existing pattern so the two slices are symmetric. All
three files live next to the code they test in
`client/src/app/features/accounts/store/`:

- [account.reducer.spec.ts](../client/src/app/features/accounts/store/account.reducer.spec.ts)
  — drives each action against a known state. The accounts slice has **three
  independent busy flags** (`loading` / `saving` / `closing`), so the key thing
  pinned down is that each action toggles the _right_ flag and leaves the others
  alone (e.g. `close` sets `closing`, not `saving`).
- [account.selectors.spec.ts](../client/src/app/features/accounts/store/account.selectors.spec.ts)
  — the derived selectors that power the "Total balance" tile and per-currency
  subtotals. The business rule baked into all of them: **CLOSED accounts are
  excluded** from every tally. We test the `.projector` functions directly
  (pure logic, isolated from the store wiring).
- [account.effects.spec.ts](../client/src/app/features/accounts/store/account.effects.spec.ts)
  — feeds an action in, stubs the API service, and asserts the mapped output
  action, covering both the **success and the failure (`catchError`) branch** of
  each effect.

Run them with `npm test` (from the root) or `npm --prefix client test`.

---

## 6. Coverage thresholds — turning a number into a gate

A coverage percentage nobody enforces is a **vanity metric**. We added gates so
the build **fails** if coverage drops below a floor.

### Jest (server) — gate the layers Jest owns

In [server/package.json](../server/package.json) we set a `coverageThreshold`
and **narrowed `collectCoverageFrom`** to the layers Jest actually unit-tests:
`services`, `repositories`, `validators`.

Why narrow it? Because the **controllers and middleware are covered by the
Cypress API suite, not by Jest** — and Jest can't see Cypress's coverage.
Leaving them in Jest's denominator would show them at 0% and make the threshold
meaningless. The principle: **each tool gates the layer it owns.** Current Jest
numbers are ~89% statements / ~86% branches, gated at a safe floor (82/75/80/82).

### Karma (client) — a "don't regress" floor

Angular's test builder has no coverage gate by default, so we added
[client/karma.conf.js](../client/karma.conf.js) with a `coverageReporter.check`
block, and pointed `angular.json`'s test target at it via `karmaConfig`.

The frontend floor is intentionally **modest** (50% statements) because the
component/UI layer is mostly covered by the **Cypress e2e** suite rather than
Karma unit tests. The floor's job here is _"coverage must not drop"_ — raise it
as more component specs land. It runs automatically because `test:ci` already
passes `--code-coverage`.

---

## 7. The full command cheat-sheet

| Command (from repo root)       | What it runs                                         |
| ------------------------------ | ---------------------------------------------------- |
| `npm run test:server`          | Jest server unit tests                               |
| `npm run test:server:coverage` | Jest + coverage **gate**                             |
| `npm test`                     | Karma client unit tests                              |
| `npm run test:all`             | server Jest + client Karma                           |
| `npm run e2e:api`              | boot server → Cypress API boundary tests → shut down |
| `npm run e2e`                  | full Cypress e2e (needs `npm start` running)         |

In **CI** ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) these run as
separate jobs — server, client, **API (Cypress)**, and format — so a failure
points straight at the layer that broke.

---

## 8. How to extend this (for the next dev)

- **Adding a server service/validator?** Drop a `*.test.js` under
  `server/__tests__/` mirroring the existing files. Keep coverage above the
  threshold or the build fails (that's the point).
- **Adding a new API endpoint?** Add a case to
  `cypress/api/http-boundary.api.cy.ts` asserting its status code + body shape.
- **Adding an NgRx slice?** Copy the three `account.*.spec.ts` files as a
  template — reducer, selectors, effects.
- **Raising the bar:** as component specs grow, bump the Karma floor in
  `karma.conf.js`. Thresholds are meant to **ratchet upward**, never down.
