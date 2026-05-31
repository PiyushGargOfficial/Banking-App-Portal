# Cypress Test Target — Which Option for a Banking-Grade Project?

> A decision guide for: **"Where should the Cypress API tests run against the
> server?"** Framed for a senior-level developer applying to a banking company.

**The question:** should the Cypress API specs hit…

- **Option A — Existing dev server (`npm start`):** Cypress hits the
  already-running mock API on `localhost:3000` via `cy.request()`. Simplest;
  matches how the app currently runs.
- **Option B — Dedicated test server in CI:** CI boots the server (e.g.
  `start-server-and-test`) before running the Cypress specs, so they run headless
  in the pipeline without a manual `npm start`.

---

## Recommendation

> ## ✅ Option B — Dedicated test server in CI
>
> It's the stronger signal for a regulated/financial environment, and the more
> senior engineering choice.

If a single answer is required, choose **Dedicated test server in CI**. The
ideal real-world setup, though, is **both** — see
[The mature answer](#the-mature-answer-do-both) below.

---

## Why it's the better signal for a banking audience

**1. Banks live and die by reproducibility and automation.**
A regulated/financial environment expects tests that run **identically on every
machine and every pipeline run, with zero manual steps**. "Run `npm start` first
in another terminal" is a human dependency — exactly the kind of thing that fails
an audit or breaks a release. Letting CI boot the server itself shows you think
in terms of *deterministic, hands-off pipelines*.

**2. It demonstrates CI/CD maturity — the seniority differentiator.**
Anyone can run Cypress against a server they started by hand. A senior is
expected to make tests a **merge gate**: PR opens → CI boots the mock API → runs
specs headless → blocks merge on failure. That's the story a banking interviewer
wants to hear.

**3. It removes a whole class of flakiness.**
`start-server-and-test` (or `wait-on`) guarantees the API is actually listening
before specs fire, then tears it down cleanly. No race conditions, no
"works on my machine," no orphaned port-3000 processes.

**4. It composes with what's already here.**
The project already runs the server and Cypress; this only adds a script and a CI
step (see [How to implement](#how-to-implement)).

---

## The honest trade-off

| | Option A — Existing dev server | Option B — Dedicated CI server |
|---|---|---|
| Setup effort | Zero | Small (one script + CI step) |
| Local developer experience | Fast inner loop | Same once scripted |
| Manual step required | **Yes** (`npm start`) | No |
| Works as a merge gate | No | **Yes** |
| Signals seniority | Low | **High** |

---

## The mature answer: do both

These options aren't truly mutually exclusive. The grown-up setup is:

- **Locally:** keep `cy.request()` hitting the already-running dev server for a
  fast inner development loop.
- **In CI:** use a dedicated `start-server-and-test` job so the suite is fully
  self-contained and gates merges.

In an interview, say it out loud:

> "I'd keep the dev-server flow for local speed, but CI must be self-contained."

That nuance **is** the senior answer — you optimize developer experience without
compromising pipeline integrity.

---

## How to implement

**1. Add the helper dependency** (dev dependency):

```bash
npm install --save-dev start-server-and-test
```

**2. Add an npm script** that boots the server, waits for the port, then runs the
specs headless:

```jsonc
// package.json
"scripts": {
  "e2e:ci": "start-server-and-test start:server http://localhost:3000 e2e"
}
```

`start-server-and-test` starts `start:server`, polls `http://localhost:3000`
until it responds, runs the `e2e` script, then shuts the server down — pass or
fail.

**3. Add a CI job** (a `.github/` workflow folder already exists in this repo):

```yaml
# .github/workflows/e2e.yml (illustrative)
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm run install:all
      - run: npm run e2e:ci    # boots server + runs Cypress headless
```

This makes the Cypress API specs run on every push with no manual `npm start`,
and lets you wire the job as a required status check to gate merges.

---

## Bottom line

For a senior candidate at a banking company, pick **Dedicated test server in CI**.
It signals reproducibility, automation, and CI/CD maturity — the exact qualities
a regulated environment rewards. Keep the dev-server flow for local speed, but
make CI self-contained. That combination is the senior-level answer.
