# Hardening pagination against oversized requests

**A junior-friendly walkthrough of why we added `MAX_PAGE_SIZE`, what it does, and how we proved it works.**

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [The problem in plain language](#2-the-problem-in-plain-language)
3. [Why this matters in real life](#3-why-this-matters-in-real-life)
4. [The fix, walked through](#4-the-fix-walked-through)
5. [Design choices we made (and why)](#5-design-choices-we-made-and-why)
6. [How to verify it works](#6-how-to-verify-it-works)
7. [What this DOESN'T solve (related hardening to do later)](#7-what-this-doesnt-solve-related-hardening-to-do-later)
8. [Cheat-sheet diff](#8-cheat-sheet-diff)

---

## 1. TL;DR

If you write a list endpoint and you accept `?size=` from the query string, **always cap the value server-side**. Otherwise a caller can send `?size=999999999` and force the server to slice and serialise a huge response — wasting memory and CPU. The cap belongs in your config, not buried in the service code, so anyone reading the project knows the limit exists.

We added a constant called `MAX_PAGE_SIZE = 100` to `server/config/index.js` and clamp both paginated list endpoints to it:

| Endpoint | Service method clamped |
|---|---|
| `GET /api/employees?size=N` | `EmployeeService.list({ size })` |
| `GET /api/employees/:id/audit?size=N` | `AuditService.listForEmployee(id, { size })` |

That's about ten lines of code in total, plus tests. It's the cheapest hardening you can ship.

---

## 2. The problem in plain language

When the frontend asks for the employee list, it sends an HTTP request like:

```
GET /api/employees?page=1&size=10
```

The server reads `size=10`, slices ten employees out of memory, turns them into JSON, and ships them back. Everything is fine because **10 is a small number**.

But the server never checked whether `size` is a *reasonable* number. It just did `Math.max(1, parseInt(size, 10) || 10)` — meaning "at least 1, otherwise default to 10". Nothing stops me from typing this into a terminal:

```bash
curl "http://localhost:3000/api/employees?size=999999999"
```

Now the server has to:

1. Pull every employee out of memory
2. Sort them
3. Filter them
4. **Slice up to 999,999,999 items**
5. **Build a JSON string of that whole slice** (`JSON.stringify` walks the entire array)
6. Stream it back to the client

In our mock backend the dataset is only 33 employees, so the slice operation completes quickly — it just gives you all 33 because `Array.slice(0, 999999999)` is fine when the array only has 33 elements. But the *general problem* is real: imagine a production database with 50,000 employees. Or imagine the audit log endpoint, where entries are append-only and can grow into the millions over time. **`size=10000000` against a real database would be expensive every single time someone fired it.**

So: even when you're not actively under attack, an oversized `size` is a **footgun** waiting for someone to lean on the trigger.

---

## 3. Why this matters in real life

Three concrete scenarios where this bites you:

### 3a. The "I'll just dump everything to a CSV" engineer

A teammate is debugging an issue and decides "I'll just grab every employee at once":

```bash
curl "https://api.bankportal.com/api/employees?size=1000000" > everyone.json
```

If the database is small, this works. They write a script around it. Then one day there are 200,000 employees, and the same call:

- Pegs one of your API server's CPU cores for 30 seconds building the JSON
- Allocates ~600 MB of heap for the response
- Sometimes crashes the Node process with `JavaScript heap out of memory`
- Sometimes runs into the load balancer's response-size limit and 502s
- **Blocks every other request to that pod for the duration**

Nobody attacked anything. The endpoint just didn't say "no" when it should have.

### 3b. The bored attacker

A real attacker who finds the endpoint can repeat:

```bash
for i in $(seq 1 1000); do
  curl "https://api.bankportal.com/api/employees?size=999999" &
done
```

A thousand parallel requests, each asking for an unbounded response. If each takes ~500 ms and ~50 MB to build, you're looking at:

- ~25 GB of allocations across your event loop
- All other requests timing out
- The process being killed and restarted by your orchestrator (Kubernetes, ECS, etc.)
- Cascading failures upstream as healthchecks fail

That's a **denial-of-service** attack made trivial by one missing line of code. It's not sophisticated — that's why it gets called a "cheap" DoS. The mitigation should be equally cheap.

### 3c. The audit log that grew forever

Audit logs are **append-only** by design (we never delete entries — see the [main README](../README.md) audit section). That means while the employee list is bounded by "how many people work here", the audit log grows monotonically forever. After 6 months in production, a single employee's audit trail could have 10,000+ entries. Without a clamp, `GET /api/employees/22222222.../audit?size=999999` is even more dangerous than the employee list.

---

## 4. The fix, walked through

We made one change in three pieces. Read it top to bottom — each piece does exactly one thing.

### Step 1 — Declare the limit in config

We added a constant to `server/config/index.js`. Why config and not the service file? Because every magic number in your codebase should have **one** definition. If a teammate later asks "is 100 the cap?" they look in one place.

```js
// server/config/index.js
module.exports = {
  PORT: process.env.PORT || 3000,
  CORRELATION_HEADER: 'x-correlation-id',
  CORS_ORIGIN,
  MAX_BALANCE: 9_999_999_999.99,

  /**
   * Hard ceiling for `?size=` on any paginated list endpoint.
   * 100 is comfortably above the UI's largest page-size select (25)
   * so legitimate consumers never notice.
   */
  MAX_PAGE_SIZE: 100
};
```

### Step 2 — Apply the clamp in `EmployeeService.list()`

**Before:**

```js
const sizeNum = Math.max(1, parseInt(size, 10) || 10);
```

Translation in plain English: *"Take whatever the caller passed in. If it's not a valid number, use 10. If it is, make sure it's at least 1."*

The bug: there's no upper bound. `parseInt("999999999")` is `999999999` and `Math.max(1, 999999999)` is just `999999999`.

**After:**

```js
const sizeNum = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, parseInt(size, 10) || 10)
);
```

Translation: *"Take whatever the caller passed in. Clean it up (default to 10, at least 1). Then **also** cap it at `MAX_PAGE_SIZE`."*

The trick is `Math.min(MAX_PAGE_SIZE, ...)`. It wraps the original logic and never lets the result climb above 100. Reading this line right-to-left tells you the whole story.

### Step 3 — Apply the same clamp in `AuditService.listForEmployee()`

The audit log is the *more important* of the two, because its dataset is unbounded over time. Same one-line change:

```js
// server/services/audit.service.js
const sizeNum = Math.min(
  MAX_PAGE_SIZE,
  Math.max(1, parseInt(size, 10) || 50)
);
```

(The default page size differs — 50 for audit vs 10 for employees — because the UI loads more audit entries per request. The *cap* is the same.)

That's it. The fix is genuinely tiny. Most production-quality patches are.

---

## 5. Design choices we made (and why)

When you write a senior-engineering-quality patch, you don't just write the code — you also justify the calls you made. Here are the four decisions in this patch and the reasoning for each.

### 5a. We **clamp**, we don't **reject**

We could have written:

```js
if (size > MAX_PAGE_SIZE) {
  return res.status(400).json(problem(400, 'Bad Request', `size must be <= ${MAX_PAGE_SIZE}`));
}
```

That's a perfectly valid choice and some banks actually prefer it because it's an explicit "the contract says no".

We chose to **silently clamp** instead, because:

1. **Backwards compatibility.** An existing client that's been sending `size=200` without realising the limit doesn't suddenly start getting 400s. It just gets the first 100. Less drama, fewer pager alerts.
2. **The response is honest.** We return the *clamped* `size` value in the JSON envelope (`{ items, total, page, size }`), so a thoughtful client sees `size: 100` instead of the `size: 999999` they asked for and knows they got capped. No silent data loss.
3. **`total` is still accurate.** The client can see "I got 100 items, but `total` says 50,000 — there's more, I should paginate."

If you're building a *public* API that other companies pay to use, you'd probably reject. For an *internal* admin tool with one consumer (our own Angular app), clamp is the right call.

### 5b. Why 100 specifically

100 isn't magic. We picked it because:

- The UI's largest page-size select option is **25**. 100 gives 4× headroom for any future UI tweak.
- A JSON array of 100 employees is roughly 10–15 KB serialised — well under any reasonable network or memory budget.
- 100 is small enough that even at 1,000 concurrent requests, you're moving 10–15 MB total in flight — nothing scary.
- 100 is the conventional default for "reasonable page size" across API design references (REST handbooks, GitHub's API, Stripe, etc.).

Could it be 50? Sure. 200? Probably. **The exact number matters less than the fact that a number exists at all.** If we ever need to change it, we update *one constant*.

### 5c. Why the clamp lives in the **service**, not the **controller**

Could we have done the clamp in `controllers/employee.controller.js` before calling the service? Yes. But:

- The service layer **owns** the rules around the data — pagination, sorting, filtering, etc. The controller's job is only HTTP plumbing.
- If a *test* calls the service with `size: 999999` directly (bypassing HTTP), it should still get clamped. The fact that it's the controller passing the query through is incidental.
- Other services (CLI scripts, scheduled jobs, batch processes) might call the same service method one day. Each of them shouldn't have to remember to clamp.

The general rule: **enforce invariants at the layer that owns them, not the layer above.**

### 5d. Why we read the limit from config inside the service

We could have written:

```js
const sizeNum = Math.min(100, ...);  // <-- hard-coded
```

…but that's a magic number with no context for whoever finds it three months from now. The version we shipped:

```js
const { MAX_PAGE_SIZE } = require('../config');
// ...
const sizeNum = Math.min(MAX_PAGE_SIZE, ...);
```

…ties the value back to a documented constant in one place. If you ever decide to make the limit configurable per-environment (e.g. `MAX_PAGE_SIZE: process.env.MAX_PAGE_SIZE || 100`), you only change `config/index.js` and every consumer is updated automatically.

---

## 6. How to verify it works

There are three layers of verification. You should be comfortable doing all three by the end of your first month as a backend dev.

### 6a. The manual smoke-test

While the server is running (`npm start`), open a terminal:

```bash
# Ask for way too many employees
curl -s "http://localhost:3000/api/employees?size=999999" | jq '.size, .items | length'
```

You should see:

```
100         <-- size in the response envelope
100         <-- number of actual items
```

The clamp kicked in. The server is unbothered.

### 6b. The Jest unit tests

We added a `MAX_PAGE_SIZE clamp` describe block to both service test files. Each block has four tests covering the cases that matter:

```js
it('returns at most MAX_PAGE_SIZE items when size=999999 is requested', () => {
  const { items } = EmployeeService.list({ size: 999999 });
  expect(items).toHaveLength(MAX_PAGE_SIZE);
});

it('reports the clamped size in the response so the caller sees the cap', () => {
  const { size } = EmployeeService.list({ size: 999999 });
  expect(size).toBe(MAX_PAGE_SIZE);
});

it('still honours the requested size when it sits under the clamp', () => {
  const { items, size } = EmployeeService.list({ size: 50 });
  expect(items).toHaveLength(50);
  expect(size).toBe(50);
});

it('reports the full total separately so callers can paginate further', () => {
  const { total } = EmployeeService.list({ size: 999999 });
  expect(total).toBe(MAX_PAGE_SIZE + 25);  // we seeded 125 rows
});
```

Notice how we test **four** things, not just the obvious one:

| Test | What it proves |
|---|---|
| Items length ≤ MAX_PAGE_SIZE | The clamp triggers when it should |
| Size field is MAX_PAGE_SIZE | The client can *see* it got clamped |
| Smaller sizes still work | We didn't break the normal path |
| Total is unchanged | The clamp affects the page, not the population |

Run them with:

```bash
npm run test:server
```

You should see the two new clamp describe blocks at the bottom of each suite, all green.

### 6c. The audit log spot-check

For the audit log specifically, the same set of tests live in `server/__tests__/services/audit.service.test.js`. Run the same command — they're part of the same suite.

To verify the live API:

```bash
# Hit the audit log endpoint with a huge size
curl -s "http://localhost:3000/api/employees/11111111-1111-1111-1111-111111111111/audit?size=999999" \
  | jq '.size'
```

Returns `100`.

---

## 7. What this DOESN'T solve (related hardening to do later)

Clamping `size` is one piece of a larger picture. As a junior dev you'll be asked about these in interviews, so it's worth knowing the neighbours.

### 7a. Rate limiting

`MAX_PAGE_SIZE` caps **one request**. It doesn't stop the same attacker from making 10,000 requests per second, each fetching 100 items. That's still 1 million records per second worth of CPU.

**Fix:** Add `express-rate-limit` (or similar) so each IP gets, say, 60 requests per minute against the list endpoints. Combined with the clamp, the worst case becomes (60 req/min × 100 items × ~150 bytes/item) ≈ 900 KB/min per attacker. Easily absorbed.

### 7b. Request body size limits

The clamp is about **response** size. Express by default lets you POST a request body up to 100 KB; we override that to 100 KB via `express.json()` defaults. But if someone POSTs a 50 MB JSON blob, the parser is still on the hook to chew through it.

**Fix:** `app.use(express.json({ limit: '32kb' }))` — a generous limit for legitimate payloads (none of ours is over 1 KB) but small enough to reject obvious abuse fast.

### 7c. Authentication and per-user quotas

Right now the audit context records `actor: 'admin'` because there's no auth. Once we add it, *who's* hitting the endpoint becomes meaningful. You can then:

- Apply different limits per role (admins might get `MAX_PAGE_SIZE: 250`, support gets 100)
- Track quotas per user (their 24-hour count of requests)
- Revoke API keys for abusers

But none of that matters until you have an `actor` you can trust. That's why "add auth" is item #2 on the senior-dev review backlog.

### 7d. Timeouts

The clamp prevents *unbounded* responses. It doesn't prevent **slow** ones. If a future query needs a complex DB join and takes 45 seconds, the client just hangs.

**Fix:** Set a timeout on the Express response. Express doesn't have a built-in middleware for this; we'd use the `connect-timeout` package or apply `req.setTimeout(10_000)` per route.

---

## 8. Cheat-sheet diff

If you were the reviewer on this PR, here's what you'd see:

**`server/config/index.js`** — added one constant:

```diff
   MAX_BALANCE: 9_999_999_999.99,
+
+  /** Hard ceiling for `?size=` on any paginated list endpoint. */
+  MAX_PAGE_SIZE: 100
 };
```

**`server/services/employee.service.js`** — one import, one line change:

```diff
+const { MAX_PAGE_SIZE } = require('../config');
 const EmployeeRepository = require('../repositories/employee.repository');

   list({ ..., page = 1, size = 10 } = {}) {
     // ...
     const pageNum = Math.max(1, parseInt(page, 10) || 1);
-    const sizeNum = Math.max(1, parseInt(size, 10) || 10);
+    const sizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || 10));
```

**`server/services/audit.service.js`** — same shape:

```diff
+const { MAX_PAGE_SIZE } = require('../config');
 const AuditRepository = require('../repositories/audit.repository');

   listForEmployee(employeeId, { page = 1, size = 50 } = {}) {
     const pageNum = Math.max(1, parseInt(page, 10) || 1);
-    const sizeNum = Math.max(1, parseInt(size, 10) || 50);
+    const sizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || 50));
```

**Tests** — one new describe block per service test file, four assertions each. See the [test files](../server/__tests__/services/) for the full text.

---

## One paragraph to remember

> Whenever your endpoint takes a number from the user and uses it to do work, ask yourself: "what's the largest value I'm willing to honour, and what happens if I'm wrong?" Then put that number in your config, enforce it as close to the data as possible (in the service, not the controller), test that **(a) it triggers**, **(b) the client can see they got capped**, **(c) normal requests still work**, and **(d) related fields like `total` stay accurate**. That's about a day's work the first time, and ten lines of code every time after.

---

*Banking Admin Portal — internal documentation.*
