# Postman — Banking Admin Portal API

A ready-to-import Postman collection covering **every** Employee and Account
endpoint (plus the audit trail) of the mock Express backend.

- Collection file: [Banking-Admin-Portal.postman_collection.json](./Banking-Admin-Portal.postman_collection.json)
- 14 requests across 3 folders: **Employees (7)**, **Accounts (6)**, **Audit (1)**

---

## Step 1 — Start the backend

Postman only sends HTTP; the server must be running to answer.

```bash
cd server
npm install      # first time only
npm start        # starts on http://localhost:3000
```

Sanity check: open <http://localhost:3000/api/employees> in a browser. JSON back
= you're good.

> The store is **in-memory** and re-seeded on every restart with \*\*33 employees
>
> - 12 accounts\*\*. Anything you create/delete is wiped when you restart `npm start`.

---

## Step 2 — Import the collection

1. Open Postman (desktop app or the VS Code Postman extension).
2. **Import** → **Files** → choose
   `postman/Banking-Admin-Portal.postman_collection.json`.
3. You'll see the **Banking Admin Portal API** collection appear in the sidebar.

No login or environment file is required — the collection ships with its own
variables.

---

## Step 3 — Understand the built-in variables (no manual editing needed)

Open the collection → **Variables** tab. Three variables are pre-defined:

| Variable     | Default                     | Purpose                                                     |
| ------------ | --------------------------- | ----------------------------------------------------------- |
| `baseUrl`    | `http://localhost:3000/api` | Prefix for every request. Change only if your port differs. |
| `employeeId` | _(empty)_                   | Auto-filled when you run **Create employee**.               |
| `accountId`  | _(empty)_                   | Auto-filled when you run **Create account for employee**.   |

**You do NOT need to copy-paste ids.** The Create requests have a small script
(their **Tests** tab) that reads the new id from the response and stores it in
these variables, so the GET/PUT/PATCH/DELETE requests below them just work.

Every request also auto-sends an `X-Correlation-Id` header (set in the
collection's pre-request script) so client and server log lines line up.

---

## Step 4 — Run the endpoints in order

Run them top-to-bottom the first time so the id variables get populated.

### Employees folder

| #   | Request                | Method | What to expect                                                               |
| --- | ---------------------- | ------ | ---------------------------------------------------------------------------- |
| 1   | List employees         | GET    | `200` + paginated list (33 seeded).                                          |
| 2   | Check email available  | GET    | `{ "available": true/false }`.                                               |
| 3   | **Create employee**    | POST   | `201` + new employee. **Saves `employeeId`.** Run this before the next ones. |
| 4   | Get employee by id     | GET    | `200` for the just-created employee.                                         |
| 5   | Replace employee (PUT) | PUT    | `200` + fully updated record.                                                |
| 6   | Patch employee status  | PATCH  | `200`, status flipped to INACTIVE.                                           |
| 7   | Delete employee        | DELETE | `204 No Content`. (Run this **last** — it removes the employee.)             |

### Accounts folder

> Needs a valid `employeeId`. Run **Create employee** first, or set `employeeId`
> to one copied from the List response.

| #   | Request                         | Method | What to expect                                               |
| --- | ------------------------------- | ------ | ------------------------------------------------------------ |
| 1   | List accounts for employee      | GET    | `200` + that employee's accounts.                            |
| 2   | **Create account for employee** | POST   | `201` + new account. **Saves `accountId`.**                  |
| 3   | Get account by id               | GET    | `200` for the just-created account.                          |
| 4   | Replace account (PUT)           | PUT    | `200` + updated account.                                     |
| 5   | Patch account (PATCH)           | PATCH  | `200`, balance updated.                                      |
| 6   | Close account (DELETE)          | DELETE | `200` + account with `status: CLOSED` (soft close, not 204). |

### Audit folder

| #   | Request                | Method | What to expect                                       |
| --- | ---------------------- | ------ | ---------------------------------------------------- |
| 1   | Get employee audit log | GET    | `200` + append-only trail of that employee's writes. |

> Tip: after running a few Employee/Account writes, hit **Get employee audit log**
> to see the entries those writes produced.

---

## Step 5 — Request body rules (so you know what's valid)

**Employee** (POST / PUT body):

```json
{
  "firstName": "Jordan",
  "lastName": "Lee",
  "email": "jordan.lee@example.com",
  "role": "SUPPORT",
  "status": "ACTIVE"
}
```

- `firstName` / `lastName`: 2–60 letters; spaces, hyphens, apostrophes allowed.
- `email`: valid format, ≤ 120 chars, **unique** (else `409 Conflict`).
- `role`: `ADMIN | MANAGER | SUPPORT` (required).
- `status`: `ACTIVE | INACTIVE`. Optional on POST (defaults to ACTIVE); **required** on PUT.
- PATCH: send only the fields you want to change.

**Account** (POST body):

```json
{
  "accountNumber": "12345678",
  "accountType": "CHECKING",
  "currency": "CAD",
  "balance": 100.5
}
```

- `accountNumber`: 8–19 digits, numeric only, **unique** (else `409`). Immutable after create.
- `accountType`: `CHECKING | SAVINGS`.
- `currency`: `CAD | USD`.
- `balance`: optional on create (defaults to 0); non-negative, ≤ 2 decimals, max `9,999,999,999.99`.
- PUT also requires `status` (`OPEN | CLOSED`). PATCH accepts any subset of `accountType, currency, balance, status`.

---

## Step 6 — Full endpoint reference

Base = `{{baseUrl}}` = `http://localhost:3000/api`

| Method | Path                                | Description                                                                    |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/employees`                        | List (query: `search, role, status, hasAccounts, sortBy, sortDir, page, size`) |
| GET    | `/employees/email-available?email=` | Unique-email check (`excludeId` optional)                                      |
| GET    | `/employees/:id`                    | Get one employee                                                               |
| POST   | `/employees`                        | Create employee                                                                |
| PUT    | `/employees/:id`                    | Replace employee                                                               |
| PATCH  | `/employees/:id`                    | Partial update                                                                 |
| DELETE | `/employees/:id`                    | Delete employee (cascades account soft-close)                                  |
| GET    | `/employees/:id/accounts`           | List an employee's accounts                                                    |
| POST   | `/employees/:id/accounts`           | Create account for employee                                                    |
| GET    | `/accounts/:accountId`              | Get one account                                                                |
| PUT    | `/accounts/:accountId`              | Replace account                                                                |
| PATCH  | `/accounts/:accountId`              | Partial update                                                                 |
| DELETE | `/accounts/:accountId`              | Soft-close account                                                             |
| GET    | `/employees/:id/audit`              | Employee audit trail                                                           |

---

## Troubleshooting

| Symptom                                       | Cause / fix                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `Could not get response` / connection refused | Backend not running. Do Step 1.                                                            |
| `404 Not Found` on every call                 | `baseUrl` wrong, or missing `/api`. All routes live under `/api`.                          |
| `404` on Get/Put/Patch/Delete by id           | `employeeId` / `accountId` variable empty. Run the matching **Create** request first.      |
| `400 Validation Failed`                       | Read the `errors[]` array in the response body — each entry names the bad `field` and why. |
| `409 Conflict`                                | Email or account number already in use. Change it.                                         |
| Body seems ignored                            | Body must be **raw → JSON** (the collection requests already are).                         |
| Data disappeared                              | Expected — in-memory store, reset on server restart.                                       |

---

## Bonus — run the whole collection at once

Use Postman's **Collection Runner** (Runner → select _Banking Admin Portal API_ →
Run). It executes the requests in order; the Create requests populate the id
variables, so the dependent requests downstream succeed automatically. Great for
a quick end-to-end smoke test.
