# CORS Security Fix — Locking Down Allowed Origins

> **Who this is for:** a developer new to this codebase (or to CORS in general) who
> wants to understand what was wrong, why it mattered for a banking app, and exactly
> what we changed.

---

## 1. The 30-second version

The server used to tell **every website on the internet** "yes, you may call my API
from a browser." For a banking app, that's a security smell. We changed it so the API
only accepts browser requests from origins **we explicitly allow** — by default just
the Angular dev server (`http://localhost:4200`), and configurable per environment via
a `CORS_ORIGIN` environment variable.

One line changed behaviour:

```js
// Before — no origin set, so the cors package defaults to allowing ALL origins (*)
app.use(cors({ exposedHeaders: [CORRELATION_HEADER] }));

// After — origin comes from config/env; defaults to the Angular dev server only
app.use(cors({ origin: CORS_ORIGIN, exposedHeaders: [CORRELATION_HEADER] }));
```

---

## 2. What is CORS, in plain English?

**CORS** = **C**ross-**O**rigin **R**esource **S**haring.

An "origin" is the combination of `scheme + host + port`, e.g. `http://localhost:4200`.
By default, browsers enforce the **same-origin policy**: JavaScript running on
`https://evil.com` is **not** allowed to read responses from `https://your-bank.com/api`.
This is a core browser security feature — it's what stops a random malicious tab from
quietly reading your bank data using **your** logged-in session.

CORS is the mechanism a server uses to say _"actually, it's OK for this specific other
origin to call me."_ The server does that by sending a response header:

```
Access-Control-Allow-Origin: https://admin.your-bank.com
```

The browser reads that header and decides whether to let the calling page see the
response. **The server is the gatekeeper** — it declares who's allowed.

---

## 3. What was wrong

In [server/app.js](../server/app.js) the CORS middleware was set up like this:

```js
app.use(cors({ exposedHeaders: [CORRELATION_HEADER] }));
```

Notice there's **no `origin` option**. When you don't tell the
[`cors`](https://www.npmjs.com/package/cors) package which origins to allow, it falls
back to its most permissive default and responds with:

```
Access-Control-Allow-Origin: *
```

The `*` means **"any origin is welcome."** So a browser page on _any_ website could
make cross-origin calls to our API and read the responses.

To make it worse, the comment right above the code **claimed the opposite**:

```
1. CORS - allow the Angular dev server origin and expose the cid header
```

So the code said "allow everyone" while the comment said "allow only the dev server."
Code and comment disagreeing is its own red flag — a reviewer can't trust either.

### Why this matters extra for a banking app

For a public, read-only marketing API, `*` might be fine. For a **banking admin
portal** that reads and writes employee and account data, advertising "any website may
call me" is exactly the kind of thing a security reviewer points at first. Even though
this particular app is a mock, shipping `*` signals you didn't think about the browser
security boundary.

---

## 4. What we changed

Two files, one idea: **the list of allowed origins now lives in config and is driven by
an environment variable**, defaulting to a single safe value instead of `*`.

### 4a. `server/config/index.js` — the new setting

We read a `CORS_ORIGIN` env var and turn it into the shape the `cors` package expects:

```js
const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';
const CORS_ORIGIN =
  rawCorsOrigin.trim() === '*'
    ? '*'
    : rawCorsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
```

What this gives you:

| `CORS_ORIGIN` value                              | Result                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| _(unset)_                                        | `['http://localhost:4200']` — the Angular dev server |
| `https://portal.bank.com`                        | `['https://portal.bank.com']`                        |
| `https://portal.bank.com,https://admin.bank.com` | an **allow-list** of both origins                    |
| `*`                                              | `'*'` — allow everything (explicit opt-in only)      |

The key point: **the insecure "allow everything" behaviour is no longer the default.**
You now have to ask for it on purpose by setting `CORS_ORIGIN=*`. The default is the
narrow, safe value.

> **Why config instead of hard-coding `http://localhost:4200`?** Because the allowed
> origin is different in every environment — `localhost:4200` in dev, a real domain in
> staging/production. Hard-coding it would mean editing source code per environment.
> Driving it from an env var is the [Twelve-Factor](https://12factor.net/config) way:
> the same build runs everywhere; only the config changes.

### 4b. `server/app.js` — using it

```js
const { CORRELATION_HEADER, CORS_ORIGIN } = require('./config');
// ...
app.use(cors({ origin: CORS_ORIGIN, exposedHeaders: [CORRELATION_HEADER] }));
```

When you hand the `cors` package an **array** of origins, it does the right thing
automatically: for each incoming request it checks whether the request's `Origin`
matches the list. If it matches, it reflects that exact origin back; if it doesn't, it
**omits the header entirely**, and the browser blocks the cross-origin read.

We also fixed the misleading comment so the code and its description finally agree.

---

## 5. How we proved it works

Static review isn't enough for a security fix — we ran the server and watched the actual
response headers for an allowed vs. a disallowed origin. (We ran it on a spare port
because a dev server was already using 3000.)

```bash
PORT=3999 node server.js &

# A request pretending to come from the allowed origin:
curl -i -H "Origin: http://localhost:4200" http://localhost:3999/api/employees?size=1
#   -> Access-Control-Allow-Origin: http://localhost:4200   ✅ reflected (allowed)

# A request pretending to come from a random site:
curl -i -H "Origin: http://evil.example.com" http://localhost:3999/api/employees?size=1
#   -> (no Access-Control-Allow-Origin header)              ✅ browser blocks the read

# A preflight (OPTIONS) check from the random site:
curl -i -X OPTIONS -H "Origin: http://evil.example.com" \
     -H "Access-Control-Request-Method: POST" http://localhost:3999/api/employees
#   -> (no Access-Control-Allow-Origin header)              ✅ preflight denied
```

| Origin in the request             | Response header we got                 | Outcome                        |
| --------------------------------- | -------------------------------------- | ------------------------------ |
| `http://localhost:4200` (allow)   | `Access-Control-Allow-Origin: ...4200` | Browser **allows** the call    |
| `http://evil.example.com`         | _(header absent)_                      | Browser **blocks** the read    |
| Preflight from `evil.example.com` | _(header absent)_                      | Browser **blocks** the request |

Before the fix, **all three** of those returned `Access-Control-Allow-Origin: *`.

The server unit test suite (43 tests) still passes — this change only affects an HTTP
response header, not any business logic.

---

## 6. Things worth knowing (common gotchas)

- **CORS is browser-enforced, not a firewall.** `curl` and Postman ignore CORS entirely
  — they happily get the data regardless. CORS only protects **browser** users from
  malicious **web pages**. It is _not_ authentication or an IP allow-list; it's one
  specific layer (stopping other websites from using a victim's session in their
  browser). Real auth still belongs on top.
- **In local dev you may not even hit CORS.** The Angular dev server proxies `/api/*` to
  the backend (see `client/src/proxy.conf.json`), so the browser thinks everything is
  same-origin. CORS matters most when the frontend and API are served from genuinely
  different origins (typical in production).
- **Don't reach for `*` to "make an error go away."** If you see a CORS error in the
  console, the fix is almost always to **add the correct origin to the allow-list**
  (via `CORS_ORIGIN`), not to open the door to everyone.

---

## 7. TL;DR for the next dev

- Allowed origins live in **`CORS_ORIGIN`** (env var), defaulting to
  `http://localhost:4200`.
- To allow more origins in another environment:
  `CORS_ORIGIN="https://a.example.com,https://b.example.com"`.
- The old insecure `*` default is gone; you can still opt into it explicitly with
  `CORS_ORIGIN=*`, but think hard before you do on a banking API.
