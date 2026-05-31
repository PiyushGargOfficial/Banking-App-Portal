# Logging PII — Why "Log Everything" Is a Trade-off

> A walkthrough for junior developers. Explains a review finding: the server logs
> **full employee and account models** (including email and balance) to the
> console on every write. That's fine for a demo, but in a real banking system
> it's a privacy concern worth gating behind a log level.

---

## Table of contents

1. [What "PII" means](#1-what-pii-means)
2. [Where this happens in our code](#2-where-this-happens-in-our-code)
3. [Why it's a concern (not just nitpicking)](#3-why-its-a-concern-not-just-nitpicking)
4. [What "info-level vs debug-level" means](#4-what-info-level-vs-debug-level-means)
5. [How to fix it](#5-how-to-fix-it)
6. [The senior move: call it out yourself](#6-the-senior-move-call-it-out-yourself)
7. [Glossary](#7-glossary)

---

## 1. What "PII" means

**PII = Personally Identifiable Information.** It's any data that can identify or
reveal something private about a person. Examples in our app:

- An employee's **email address** (identifies a person).
- An account's **balance**, **account number**, **currency** (financial data —
  especially sensitive in a banking context).

The rule of thumb: if you'd be uncomfortable seeing it printed on a screen in a
shared office, it probably shouldn't be sitting in plain-text logs by default.

---

## 2. Where this happens in our code

Both services have a small helper that prints the **entire model** as formatted
JSON every time something is created, updated, or closed.

**Employees** — [server/services/employee.service.js](../server/services/employee.service.js):

```js
const logModel = (action, model, context) => {
  const cid = context?.correlationId || 'n/a';
  console.log(`[employee] ${action} cid=${cid}\n${JSON.stringify(model, null, 2)}`);
};
```

It's called on CREATE and UPDATE — so every write prints the full employee,
**including `email`**.

**Accounts** — [server/services/account.service.js](../server/services/account.service.js):

```js
const logModel = (action, model, context) => {
  const cid = context?.correlationId || 'n/a';
  console.log(`[account] ${action} cid=${cid}\n${JSON.stringify(model, null, 2)}`);
};
```

Called on CREATE, UPDATE, and CLOSE — so every write prints the full account,
**including `balance` and `accountNumber`**.

A real log line looks like this:

```
[account] CREATE cid=abc-123
{
  "accountId": "…",
  "accountNumber": "4023600099887766",
  "balance": 15230.55,
  "currency": "CAD",
  ...
}
```

That `console.log` runs **unconditionally** — there's no switch to turn it off.
That's the crux of the finding.

> Note: this is **not** the same as the HTTP access log (Morgan in
> [server/middleware/logger.js](../server/middleware/logger.js)), which only logs
> method/URL/status/correlation-id — no PII. The concern is specifically the
> *full-model* dump in the services.

---

## 3. Why it's a concern (not just nitpicking)

For a take-home demo with fake seed data, printing everything is genuinely
**helpful** — you can watch writes happen and trace them by correlation id. So
why does a reviewer flag it?

Because in a **real banking system**, logs are not private. They typically get:

- shipped to a central aggregator (Datadog, Splunk, CloudWatch, the ELK stack…),
- **retained for months or years** for audit purposes,
- **viewable by people** who have no business seeing customer financial data
  (on-call engineers, ops, support).

So "just a `console.log`" quietly becomes "every customer's email and balance,
copied into a searchable system, kept for years, readable by dozens of people."
That can violate privacy regulations (GDPR, PCI-DSS, etc.) and is a classic way
sensitive data **leaks without anyone attacking anything** — it just sits there.

The point isn't "logging is bad." It's: **log the fact that something happened,
not the sensitive contents of what happened** — at least not by default.

---

## 4. What "info-level vs debug-level" means

Loggers usually support **levels** that rank how important/verbose a message is.
A common ordering, least to most verbose:

```
error  <  warn  <  info  <  debug  <  trace
```

You configure a **threshold** (often via an env var like `LOG_LEVEL`) and only
messages at or above it are printed.

- In **production**, you'd typically run at `info` — so `debug`/`trace` messages
  are silently skipped.
- In **development**, you'd run at `debug` to see everything.

A plain `console.log` has **no level** — it always prints. That effectively makes
our full-model dump an **always-on, info-level** message. The fix is to demote it
to **debug**, so the PII only appears when a developer explicitly opts in.

---

## 5. How to fix it

The cheapest, clearest fix: only dump the full model when the log level is
`debug`. For example:

```js
const logModel = (action, model, context) => {
  const cid = context?.correlationId || 'n/a';

  if (process.env.LOG_LEVEL === 'debug') {
    // Full model — only when a developer explicitly opts in.
    console.log(`[account] ${action} cid=${cid}\n${JSON.stringify(model, null, 2)}`);
  } else {
    // Default: log that a write happened + how to trace it — NO PII.
    console.log(`[account] ${action} accountId=${model.accountId} cid=${cid}`);
  }
};
```

Now the default log still tells you **what happened** (a CREATE) and **how to
trace it** (the id + correlation id), but it doesn't spill the balance or account
number unless someone runs with `LOG_LEVEL=debug`.

Other good options (any one is fine):

- **Redact specific fields** before logging (`email: "j***@x.com"`,
  `balance: "[redacted]"`).
- **Log only an id + the action**, never the body, at info level.
- Use a real logger (pino, winston) that has built-in levels and redaction.

For this project, the `LOG_LEVEL` gate is the smallest change that addresses the
finding.

---

## 6. The senior move: call it out yourself

Here's the part that matters for an interview or review.

A junior dev hopes nobody notices the trade-off. A **senior dev names it first**.
The fact that we log full models is a *reasonable* demo decision — it aids
debugging. What makes it look senior is **showing you understand the production
implication** and documenting it as a conscious choice.

So in the README (or here), add a short note like:

> **Logging note:** The mock services log full entity models to stdout on each
> write to make the demo easy to trace. In production this would be gated behind
> `LOG_LEVEL=debug` (or field-redacted), since employee email and account balance
> are PII and application logs are typically centralized and long-retained.

That single paragraph turns a potential ding ("they log PII") into a plus
("they understand PII, log levels, and made a deliberate demo trade-off").
**Self-awareness reads as seniority.**

---

## 7. Glossary

| Term | Plain-English meaning |
|---|---|
| **PII** | Personally Identifiable Information — data that identifies/reveals private details about a person (email, balance, account number). |
| **Log level** | A ranking of message importance (`error` → `debug`). You set a threshold; lower-priority messages are skipped. |
| **`LOG_LEVEL`** | A common environment variable that sets that threshold (e.g. `info` in prod, `debug` in dev). |
| **Redaction** | Masking sensitive parts of a value before logging (`j***@x.com`). |
| **Log aggregation / retention** | Logs get shipped to a central system and kept for a long time — which is *why* PII in logs is risky. |
| **Correlation id** | A per-request id (here `cid`) that ties a client log line to the matching server log line for tracing. Safe to log — it's not PII. |

---

**Bottom line:** logging full employee/account models is a fine *demo* choice but
an *info-level PII leak* in production. Gate it behind `LOG_LEVEL=debug` (or redact
the sensitive fields), and — most importantly — **call out the trade-off yourself**
in the README.
