# How Would You Scale This 10x?

> A deep-dive for junior developers (and a senior interview answer). The
> interviewer's real question isn't "rewrite the app" — it's *"do you know where
> this breaks first, and do you reach for the right tool for each bottleneck?"*
> This doc takes each line of the scaling table and explains it in detail: what
> the bottleneck **is**, **why** it bites at scale, the **fix**, **how** the fix
> works, and what's **already in place** that makes the fix cheap.

**What "10x" means here.** Not "10x the code" — 10x the *load*: ~10x the
employees/accounts, 10x the concurrent admins, 10x the requests per second. The
art is naming the bottleneck that fails **first**, then the next, then the next.

The summary table (from [INTERVIEW_PLAYBOOK.md §4](./INTERVIEW_PLAYBOOK.md#4-architecture-you-can-draw-on-the-fly)):

| Bottleneck today | 10x answer |
|---|---|
| In-memory store | Postgres with targeted indexes |
| Audit log grows unbounded | Event-sourcing shape + Redis read model |
| Single Express process | Horizontal scale behind a load balancer |
| Full-list work per filter change | Server-side pagination (already here) + CDN caching |
| No tracing | OpenTelemetry off the existing correlation-id |
| First-load bundle size | Lazy loading (already here), route-anchored components |

---

## Table of contents

1. [In-memory store → Postgres with indexes](#1-in-memory-store--postgres-with-indexes)
2. [Unbounded audit log → event-sourcing + Redis read model](#2-unbounded-audit-log--event-sourcing--redis-read-model)
3. [Single Express process → horizontal scale](#3-single-express-process--horizontal-scale)
4. [Full-list work per filter → pagination + CDN caching](#4-full-list-work-per-filter--pagination--cdn-caching)
5. [No tracing → OpenTelemetry off the correlation-id](#5-no-tracing--opentelemetry-off-the-correlation-id)
6. [First-load bundle size → lazy loading](#6-first-load-bundle-size--lazy-loading)
7. [The order things break (and why that matters)](#7-the-order-things-break-and-why-that-matters)
8. [Glossary](#8-glossary)

---

## 1. In-memory store → Postgres with indexes

### The bottleneck today

All data lives in a plain JavaScript object in memory —
[server/data/store.js](../server/data/store.js) holds `employees`, `accounts`, and
`auditLog` arrays. Repositories like
[employee.repository.js](../server/repositories/employee.repository.js) do
`store.employees.find(...)` over those arrays.

Two problems at scale:

1. **It's volatile.** Restart the process and everything is gone (it reseeds).
   No durability, no sharing between processes.
2. **Every lookup is a full array scan — O(n).** `findByEmail` walks the whole
   array. At 33 employees that's instant. At 330,000 it's a linear scan on
   *every* request, and there's no way to have two servers share the data.

### The fix: Postgres with targeted indexes

Move the store to a real database. The **repository pattern already isolates this
change** — only the files in [repositories/](../server/repositories/) touch the
store, so services, controllers, and validators don't change at all. That's the
entire payoff of the layering: swapping the storage engine is a
**one-layer** edit.

The indexes aren't arbitrary — each one matches a query the app actually runs:

| Index | The query it serves | Why |
|---|---|---|
| `email` (unique) | `findByEmail` — the unique-email check on create/edit | Without it, every email check scans the whole table. With it, it's a O(log n) tree lookup. The `UNIQUE` constraint *also* enforces the business rule at the DB level — a second line of defence behind the app check. |
| `(employeeId, accountId)` | "list this employee's accounts" / fetch one account | A **composite** index: filtering accounts by their owner is the hot path on the detail page. Leading with `employeeId` means the DB can jump straight to that employee's rows. |
| `(employeeId, timestamp DESC)` | the audit-log read: "newest entries for this employee" | This is the killer one. The audit log is read **newest-first, per employee**. An index sorted by `timestamp DESC` *within* each `employeeId` means the DB returns page 1 by reading the first N rows of the index — no sort step at all. |

### How an index actually helps (junior explanation)

An index is like the index at the back of a textbook. Without it, finding every
mention of "mitochondria" means reading all 800 pages (a full scan). With it, you
flip to the index, find the entry, and jump to the exact pages. A database index
is a sorted structure (usually a B-tree) that turns "scan everything" into "walk
a tree" — O(n) becomes O(log n).

**Composite index ordering matters.** `(employeeId, timestamp DESC)` is great for
"this employee's entries, newest first" but useless for "all entries newest first
across everyone" — the leading column has to match how you filter. Naming *which*
index for *which* query is what makes this a senior answer instead of "add some
indexes."

### Trade-offs to mention

- Indexes **speed up reads but slow down writes** (every insert updates the index too) and use disk. You index the hot read paths, not every column.
- Moving to Postgres adds a real dependency and a migration story. For a take-home that's out of scope — but the *seam* is ready.

---

## 2. Unbounded audit log → event-sourcing + Redis read model

### The bottleneck today

The audit log is **append-only** — see
[audit.service.js](../server/services/audit.service.js). Every write records an
entry; nothing is ever updated or deleted. That's exactly right for compliance,
but it means the log **only grows**. At 10x, the per-employee read
(`listForEmployee`, newest-first, paginated) is scanning an ever-larger array.

### The fix, part 1: it's already event-sourcing-shaped

**Event sourcing** means: instead of only storing the *current* state, you store
the **sequence of events** that produced it. The current state is a *projection*
you can rebuild by replaying events.

Our audit log is already a stream of immutable events (`CREATE`, `UPDATE` with a
field-level diff, `CLOSE`, `REOPEN`, `CASCADE_CLOSE`). Because nothing mutates
existing rows, it "slots straight into" an event-sourcing model — you'd persist
those events to an append-only event store (or a Postgres table you never
`UPDATE`). The append-only design we chose for *compliance* reasons happens to be
the exact shape event sourcing wants. That's the point worth making: **a good
domain decision paid off twice.**

### The fix, part 2: a Redis read model (materialised view)

Reading is the scaling problem, not writing. So split the two (this is **CQRS** —
Command Query Responsibility Segregation):

- **Write side:** keep appending events (the source of truth).
- **Read side:** maintain a pre-computed answer to the one hot query —
  "the latest N audit entries for employee X" — in **Redis**, an in-memory
  key-value store that serves reads in microseconds.

A **materialised view** is a query result you compute *once* and store, instead of
recomputing it on every request. Here: each time an event is appended for employee
X, you push it onto a capped Redis list keyed by `audit:{employeeId}`. The
detail-page read then becomes "give me the first 50 items of this Redis list" —
no scan, no sort, no database round-trip.

### How it fits together

```
 write  ──► append event (source of truth, durable)
            │
            └─► update Redis read model  audit:{employeeId} (capped list, newest-first)
 read   ──► Redis list slice (microseconds)   ◄── the detail page hits this
```

### Trade-offs to mention

- The read model is **eventually consistent** — there's a tiny window where the event is stored but the Redis projection hasn't updated. For an audit log that's fine (a half-second lag is invisible). For a bank *balance* it would not be.
- You now have two stores to keep in sync; the event store remains the source of truth, so Redis can always be rebuilt by replaying events. That rebuildability is *why* event sourcing makes this safe.

---

## 3. Single Express process → horizontal scale

### The bottleneck today

One Node.js process serves everything ([server.js](../server/server.js)). Node is
single-threaded for your JS code, so one process uses roughly one CPU core. At 10x
traffic, that one process becomes the ceiling — and if it crashes, the whole API
is down.

### The fix: run many identical processes behind a load balancer

**Horizontal scaling** = add more *machines/processes* (scale out), as opposed to
**vertical scaling** = make one machine bigger (scale up). You put N identical
Express instances behind a **load balancer** that spreads incoming requests across
them.

### Why this is *only* possible after step 1

This is the subtle, senior point: **horizontal scaling requires the servers to be
stateless.** Today the state lives *inside* the process (the in-memory store). If
you ran three copies, each would have its **own** copy of the data — create an
employee on instance A, and instances B and C don't know it exists. Chaos.

Once the store moves to Postgres (step 1), the Express process holds **no
in-process state** — every instance reads/writes the same shared database. *Now*
you can run as many instances as you want; they're interchangeable. The load
balancer can kill and restart any of them freely.

So the dependency chain is: **step 1 (shared DB) unlocks step 3 (horizontal
scale).** Naming that ordering is the high-value part of the answer.

### Trade-offs to mention

- Anything that *was* in-process state has to move out: sessions → Redis/JWT, file uploads → object storage, in-memory caches → shared cache. Our app is already close to stateless apart from the store.
- You now need health checks and graceful shutdown so the load balancer routes around a dying instance.

---

## 4. Full-list work per filter → pagination + CDN caching

### The bottleneck today — and what's already solved

A naive list page fetches **all** rows and filters/sorts on the client. Every
keystroke in the filter re-processes the entire dataset. At 10x rows that's a huge
payload and janky UI.

**This is already handled.** The list endpoint does
search/filter/sort/pagination **server-side**
([employee.service.js](../server/services/employee.service.js) `list()`), so the
client always receives **one bounded page** (default 10, max 100), never the whole
table.

### The MAX_PAGE_SIZE clamp (the hardening that makes caching safe)

[config/index.js:44](../server/config/index.js#L44) sets `MAX_PAGE_SIZE: 100`, and
the service clamps every request:

```js
const sizeNum = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(size, 10) || 10));
```

So `?size=999999` is silently capped at 100, and the clamped value is echoed back
in the response so the client knows what it actually got. **Why this matters for
scale:** without it, one caller (or attacker) could ask for `?size=999999` and
force the server to build and serialise an enormous response — a cheap way to
exhaust memory. The clamp guarantees **every** response is bounded, which is what
makes the next step (caching) safe and predictable.

### The fix: CDN-cache `GET /api/employees`

A **CDN** (Content Delivery Network) is a layer of edge caches between the user and
your server. If many admins request the same first page of employees, the CDN can
serve a cached copy without ever hitting Express.

The catch: the list response **varies** by query params (`search`, `role`, `page`,
`size`…) and potentially by user. So you cache with the right **`Vary` headers**
and cache-key rules — the cache key must include the query string, so
`?role=ADMIN&page=1` and `?role=SUPPORT&page=1` are cached as different entries.
`Vary` tells the cache *which* request attributes make a response different.

### Trade-offs to mention

- List data changes when someone edits an employee, so you cache for a **short** TTL (seconds) or use cache invalidation on write. Stale-for-a-few-seconds is usually fine for an admin list; never cache a single-record detail or a balance the same way.
- Don't CDN-cache authenticated, user-specific responses without keying on the user — that's how you leak one user's data to another.

---

## 5. No tracing → OpenTelemetry off the correlation-id

### The bottleneck today

With one process and `console.log`, you can eyeball what happened. At 10x — many
instances, many concurrent requests — "which log lines belong to the request that
failed?" becomes impossible by eye. You need **distributed tracing**: following a
single request across every service it touches.

### The fix: we already emit the hard part

A trace needs a shared **id** that travels with the request so every log/span can
be correlated. **We already have it.** The client interceptor
([correlation-id.interceptor.ts](../client/src/app/core/interceptors/correlation-id.interceptor.ts))
mints an `X-Correlation-Id` on every request; the server middleware
([correlation-id.js](../server/middleware/correlation-id.js)) reads/echoes it and
the morgan logger ([logger.js](../server/middleware/logger.js)) stamps every log
line with it.

**OpenTelemetry** is the industry-standard framework for emitting traces/metrics
to tools like Jaeger, Honeycomb, or Datadog. Adopting it means: feed the existing
correlation-id in as the trace id, wrap each layer (controller → service →
repository) in a "span," and export. Because the id is *already threaded through
the whole request*, you get request-level traceability **with essentially zero
application changes** — you're wiring up an exporter, not re-plumbing the app.

### Why "zero application changes" is the senior flex

Most teams discover at scale that they never propagated a request id, and
retrofitting it touches every handler. We designed it in from day one for a
*different* reason (tying client and server log lines together during debugging),
and that decision pays off again here. Same theme as the audit log: **a good
early decision compounds.**

### Trace vs log (junior clarification)

- A **log** is a single timestamped message ("HTTP error, status 500").
- A **trace** is the *whole journey* of one request — a tree of timed spans showing it entered the controller, spent 4 ms in the service, 30 ms waiting on Postgres, then returned. The correlation-id is the thread that stitches those spans (and the logs) together.

---

## 6. First-load bundle size → lazy loading

### The bottleneck today — and what's already solved

A Single Page App ships JavaScript to the browser. If *everything* is in one
bundle, the user downloads the entire app — every page, every component — before
they see anything. More features = slower first paint.

**Already handled.** The app **lazy-loads** at two levels:

- The whole employees feature is `loadChildren`-ed in [app.routes.ts](../client/src/app/app.routes.ts) — its code isn't in the initial bundle.
- Each page (`list`, `detail`, `form`) is `loadComponent`-ed in [employees.routes.ts](../client/src/app/features/employees/employees.routes.ts) — each ships as its own chunk, fetched on navigation.

### "Route-anchored" components

The audit-log component is only used on the employee **detail** page, so it ships
inside the detail chunk — it's **route-anchored**. A user who only ever views the
list never downloads the audit-log code at all. The work scales with *what the
user actually visits*, not with the total size of the app. At 10x features, first
load stays roughly flat because new features land in their own lazy chunks.

### What you'd add at true scale

- **Bundle analysis** (`webpack-bundle-analyzer` / `source-map-explorer`) to find heavy dependencies — honest caveat: this project hasn't had that pass yet.
- **Preloading strategies** (e.g. `PreloadAllModules` or a custom one) to fetch likely-next chunks during idle time, so lazy loading doesn't cost a visible delay on navigation.
- A **CDN for static assets** (the JS/CSS bundles) so the app shell loads from an edge near the user.

---

## 7. The order things break (and why that matters)

The single most senior move in this answer is **sequencing**: knowing what fails
first and what unlocks what.

```
1. In-memory store          ← fails FIRST (volatile + O(n) + can't share)
   └─ unlocks ─► 3. Horizontal scale (needs a shared DB to be stateless)

2. Audit log read volume    ← grows steadily; CQRS/Redis when reads dominate

4. List payload/CPU         ← already mitigated (server-side pagination + clamp)
                              CDN caching is an optimisation, not a rescue

5. Observability            ← not a "crash" bottleneck, but you'll be blind
                              without it once you have many instances

6. Front-end first load     ← already mitigated by lazy loading; revisit with
                              bundle analysis as features grow
```

**How to say it in the room:**

> *"The in-memory store breaks first — it's volatile and every lookup is a full
> scan. I'd move it to Postgres, and because the repository pattern isolates data
> access, that's a one-layer change. Crucially, a shared database is also what
> makes the Express tier stateless, which unlocks horizontal scaling behind a load
> balancer. After that, the audit log's read volume is the next pressure point —
> it's already append-only, so it slots into an event-sourcing model with a Redis
> read model for the per-employee query. A lot of the rest is already handled:
> pagination with a MAX_PAGE_SIZE clamp keeps payloads bounded, the correlation-id
> is ready for OpenTelemetry, and the front end already lazy-loads per route."*

That answer shows three things: you know where it breaks, you know the
dependencies between fixes, and you know what you **already** did that makes the
fixes cheap.

---

## 8. Glossary

| Term | Plain-English meaning |
|---|---|
| **Index** | A sorted lookup structure (B-tree) that turns "scan every row" into "walk a tree" — O(n) → O(log n). |
| **Composite index** | An index on multiple columns in order; the leading column must match how you filter for it to help. |
| **Horizontal scaling** | Add more machines/processes (scale out). Vs **vertical** = make one machine bigger (scale up). |
| **Stateless server** | A server that keeps no data in its own process, so any instance can handle any request. Prerequisite for horizontal scale. |
| **Load balancer** | A component that spreads incoming requests across multiple identical server instances. |
| **Event sourcing** | Store the sequence of immutable events, not just current state; rebuild state by replaying them. |
| **CQRS** | Command Query Responsibility Segregation — separate the write model from the read model. |
| **Materialised view / read model** | A pre-computed query answer you store and serve directly, instead of recomputing each request. |
| **Redis** | An in-memory key-value store; serves reads in microseconds; great for caches and read models. |
| **CDN** | Content Delivery Network — edge caches between users and your server. |
| **`Vary` header / cache key** | Tells a cache which request attributes (query string, headers) make a response distinct. |
| **Distributed tracing** | Following one request across every service it touches, as a tree of timed spans. |
| **OpenTelemetry** | The standard framework for emitting traces/metrics/logs to observability tools. |
| **Lazy loading** | Downloading a feature's code only when the user navigates to it, keeping first load small. |
| **MAX_PAGE_SIZE clamp** | Capping `?size=` (here at 100) so no request can force an unbounded response. |

---

*See also: [INTERVIEW_PLAYBOOK.md](./INTERVIEW_PLAYBOOK.md) (the scaling table in
context), [INTERVIEW_PREP.md](./INTERVIEW_PREP.md) (how to deliver the demo), and
the [MAX_PAGE_SIZE_CLAMP](./MAX_PAGE_SIZE_CLAMP.md) deep-dive if present.*
