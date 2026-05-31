# Email-Availability Check — Investigation & Findings

> A walkthrough for junior developers. A reviewer reported that the
> `email-available` endpoint says an email is **available** even though creating
> an employee with "the same" email returns **409 Conflict**. This documents how
> the issue was investigated, what was actually happening, and the one small
> hardening that came out of it.

**TL;DR:** The endpoint was **not** broken. The POST created
`jordan.lee3@example.com`, but the availability check queried
`jordan.lee@example.com` (no `3`) — two different addresses. The endpoint
correctly reported the un-created one as available. A minor whitespace-trimming
inconsistency was found and fixed as a bonus.

---

## Table of contents

1. [The reported symptom](#1-the-reported-symptom)
2. [How we investigated](#2-how-we-investigated-dont-guess-reproduce)
3. [Root cause: the emails were different](#3-root-cause-the-emails-were-different)
4. [Second thing that can cause this: the in-memory store](#4-second-thing-that-can-cause-this-the-in-memory-store)
5. [What the endpoint does correctly](#5-what-the-endpoint-does-correctly)
6. [The one real fix: whitespace consistency](#6-the-one-real-fix-whitespace-consistency)
7. [How to test it correctly](#7-how-to-test-it-correctly)
8. [Takeaways](#8-takeaways)

---

## 1. The reported symptom

1. `POST {{baseUrl}}/employees` with an employee → **201 Created**. 👍
2. `POST` the **same** employee again → **409 Conflict**, `"Email is already in use"`. 👍 (correct)
3. `GET {{baseUrl}}/employees/email-available?email=jordan.lee@example.com` → `{ "available": true }`. 👎 (looked wrong)

The expectation: step 3 should say `available: false`, because step 2 proved the
email is taken. So at first glance the availability endpoint looks buggy.

---

## 2. How we investigated (don't guess — reproduce)

The senior habit here is **don't trust the description, reproduce the behavior**.
Instead of reading the code and guessing, we loaded the real server modules and
ran the exact logic:

```js
const Emp = require('./services/employee.service');
Emp.create({ firstName:'Jordan', lastName:'Lee', email:'jordan.lee3@example.com', ... });

const check = (email) => ({ email, available: !Emp.isEmailTaken(email, '') });
check('jordan.lee3@example.com'); // { available: false }  ← taken, correct
check('jordan.lee@example.com');  // { available: true }   ← never created, correct
check('JORDAN.LEE3@EXAMPLE.COM'); // { available: false }  ← case-insensitive, correct
```

The output proved the endpoint logic is **correct**. That immediately reframed
the question from "why is the code wrong?" to "why did the two requests
disagree?"

---

## 3. Root cause: the emails were different

Look closely at the two requests:

| Step | Email used |
|---|---|
| POST that returned 409 | `jordan.lee`**`3`**`@example.com` |
| email-available query | `jordan.lee@example.com` |

They differ by a single character — the **`3`**. The employee that exists is
`jordan.lee3@example.com`. The availability check asked about
`jordan.lee@example.com`, which was **never created**. So `available: true` is
the **correct** answer.

It's an easy mistake to make in Postman: you tweak the email in the POST body to
get past a 409, then forget to update the same value in the query string of a
different request. The API did exactly what it should.

> **Lesson:** a uniqueness check is only as good as the string you give it. "Same
> employee" to a human ≠ "same email string" to the server.

---

## 4. Second thing that can cause this: the in-memory store

Even with identical emails, there's a second way to see this — and it's worth
knowing because it surprises people.

This backend stores data **in memory** and **re-seeds on every restart** (see the
README "Notes for the reviewer"). There is no database. So:

1. Create `jordan.lee@example.com` → it exists **in this running process**.
2. Restart the server (or it restarts via a file-watcher/nodemon).
3. The store is wiped and reseeded — your created employee is **gone**.
4. `email-available?email=jordan.lee@example.com` → `available: true` (correct —
   it no longer exists).

If you ever see availability "reset," check whether the server restarted between
your create and your check.

---

## 5. What the endpoint does correctly

For the record, these behaviors were all verified as working:

- **Detects a real clash.** A created email reports `available: false`.
- **Case-insensitive.** `JORDAN.LEE3@EXAMPLE.COM` matches `jordan.lee3@example.com`. The comparison lowercases both sides in [employee.repository.js](../server/repositories/employee.repository.js) (`findByEmail`).
- **`excludeId` support.** Edit forms pass the employee's own id so their existing email doesn't count as a clash against themselves. Empty/omitted `excludeId` simply excludes nobody.
- **Consistent with create.** The create controller checks `isEmailTaken` before inserting, which is why the duplicate POST returns 409 — the same repository method backs both paths.

---

## 6. The one real fix: whitespace consistency

The investigation did surface a genuine — if minor — inconsistency.

- The **create/replace** path runs the body through [sanitize.js](../server/utils/sanitize.js), which **trims** whitespace before storing. So `"  jordan.lee3@example.com  "` is stored as `"jordan.lee3@example.com"`.
- The **email-available** endpoint did **not** trim its query email.

Result: a query email with stray leading/trailing spaces would be compared
against the trimmed stored value, fail to match, and falsely report
`available: true`. (The repository lowercases for comparison but does not trim.)

**The fix** — one line in [employee.controller.js](../server/controllers/employee.controller.js),
`emailAvailable`:

```js
// before
const email = (req.query.email || '').toString();
// after — mirror the create path, which trims via sanitize()
const email = (req.query.email || '').toString().trim();
```

Verified after the change:

| Query | Result |
|---|---|
| `jordan.lee3@example.com` | `available: false` ✓ |
| `"  jordan.lee3@example.com  "` (whitespace) | `available: false` ✓ *(was `true` before the fix)* |
| `JORDAN.LEE3@EXAMPLE.COM` | `available: false` ✓ |
| `jordan.lee@example.com` (the un-created one) | `available: true` ✓ |

> **Important:** this fix does **not** change the originally-reported result.
> `jordan.lee@example.com` is still correctly `available: true`, because that
> exact address was never created. The trim only closes the whitespace edge case.

---

## 7. How to test it correctly

To reproduce the *correct* round-trip in Postman:

1. **Create:** `POST {{baseUrl}}/employees` with, say, `jordan.lee3@example.com` → 201.
2. **Check the SAME email:** `GET {{baseUrl}}/employees/email-available?email=jordan.lee3@example.com` → `{ "available": false }`.
3. **Check a DIFFERENT email:** `...?email=brand.new@example.com` → `{ "available": true }`.

The key is using the **exact same string** in step 2 that you created in step 1.
Copy-paste it rather than retyping. The collection in [postman/](../postman/) wires
the created id into a variable for exactly this reason — to avoid hand-copy slips.

---

## 8. Takeaways

- **Reproduce before fixing.** The fastest way to resolve "this is broken" is to
  run the real code with the real inputs. Here it turned a "bug report" into a
  one-character data mismatch.
- **A uniqueness check compares strings, not intentions.** `jordan.lee` and
  `jordan.lee3` are different to the server even if they look "the same" at a
  glance.
- **Know your storage model.** In-memory + reseed-on-restart means "it
  disappeared" is sometimes the correct, expected behavior.
- **Keep normalization consistent across paths.** Create trimmed; the check
  didn't. Closing that gap is the real, defensible improvement that came out of
  the investigation.
