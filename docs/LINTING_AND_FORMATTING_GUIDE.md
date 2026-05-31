# Linting & Formatting Guide

> **Who this is for:** a developer new to this codebase (or to linting in general)
> who wants to understand what tooling we added, _why_, and how to use it day to day.

---

## 1. The 30-second version

We added three tools that keep the code consistent and catch mistakes _before_ they
reach a reviewer or production:

| Tool             | Job (in one line)                                            | "Is my code…"           |
| ---------------- | ------------------------------------------------------------ | ----------------------- |
| **ESLint**       | Finds **bugs and bad patterns** (unused vars, missing a11y…) | …_correct_?             |
| **Prettier**     | Auto-formats **whitespace, quotes, line breaks**             | …_consistently styled_? |
| **EditorConfig** | Tells your editor the basics (indent = 2 spaces, LF endings) | …_typed consistently_?  |

You only need to remember two commands:

```bash
npm run lint      # check everything for problems (does not change files)
npm run format    # auto-fix all formatting (changes files)
```

Run both from the **project root**.

---

## 2. Why we bothered (the "so what")

Before this change, the project had **no linter and no formatter at all**. That's a
problem for a "production-ready" codebase because:

- **Style drifts.** One file uses single quotes, another double; tabs here, spaces
  there. Every pull request fills up with pointless "you have a stray space" comments.
- **Real bugs hide.** An unused variable, a `==` where you meant `===`, a button with
  a click handler but no keyboard support — a linter flags these automatically.
- **It's the first thing a reviewer checks.** If `npm run lint` doesn't exist (or
  fails), it signals the engineering basics aren't in place.

The fix is to let machines enforce the boring rules so humans can review the
**logic**.

### ESLint vs. Prettier — they are NOT the same thing

This trips up a lot of people. The simplest mental model:

- **Prettier** cares about how the code _looks_ — it reprints your file. It has no
  opinion about whether the code is correct.
- **ESLint** cares about how the code _behaves_ — unused imports, risky patterns,
  accessibility, Angular-specific rules.

They can step on each other's toes (both have opinions about, e.g., semicolons), so we
installed [`eslint-config-prettier`](https://github.com/prettier/eslint-config-prettier),
which **switches off every ESLint rule that's purely about formatting**. Result:
Prettier owns formatting, ESLint owns correctness, and they never argue.

---

## 3. What we installed and where the config lives

The project is a small monorepo: a **`client/`** (Angular 17) and a **`server/`**
(Express/Node), with a thin **root** that orchestrates both.

```
Banking-App-Portal/
├── .editorconfig          ← editor defaults (shared by everything)
├── .prettierrc.json       ← Prettier rules (shared)
├── .prettierignore        ← files Prettier should skip (node_modules, dist…)
├── package.json           ← root: "lint" + "format" umbrella scripts
│
├── client/
│   ├── .eslintrc.json     ← Angular + TypeScript lint rules
│   └── package.json       ← "lint" script (runs `ng lint`)
│
└── server/
    ├── .eslintrc.json     ← Node/CommonJS lint rules
    ├── .eslintignore      ← skip node_modules, coverage
    └── package.json       ← "lint" script (runs `eslint .`)
```

### Why config lives in two places

ESLint config is **per-package** because the two sides are genuinely different
environments: the client is browser TypeScript with Angular decorators and HTML
templates; the server is Node.js CommonJS (`require`/`module.exports`). They need
different rule sets and different parsers, so each gets its own `.eslintrc.json`.

Prettier config is **shared at the root** because formatting (quotes, indent width,
line length) should look identical everywhere — there's no reason for the two sides to
disagree on what a comma looks like.

---

## 4. The commands, explained

All of these run from the **project root**.

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run lint`         | Lints **server then client**. Read-only — reports, never edits.  |
| `npm run lint:server`  | Lints only the server.                                           |
| `npm run lint:client`  | Lints only the client (`ng lint`).                               |
| `npm run format`       | **Rewrites** every file to match Prettier. Use this to auto-fix. |
| `npm run format:check` | Checks formatting **without changing files**. Used by CI.        |

Each sub-package also has its own fixer:

| Command (inside `server/` or `client/`) | What it does                                    |
| --------------------------------------- | ----------------------------------------------- |
| `npm run lint:fix` _(server)_           | Auto-fixes the ESLint problems it knows how to. |

> **Tip:** `lint` only _reports_. To actually fix things, run `npm run format` (style)
> and `npm --prefix server run lint:fix` (server lint auto-fixes). Many ESLint
> problems can't be auto-fixed because they need a human decision — that's by design.

### A typical workflow

```bash
# 1. You finish writing a feature.
npm run format        # tidy up all formatting automatically
npm run lint          # see if there are any real problems left
# 2. Fix whatever lint reports (these usually need a brain, not a script).
# 3. Commit. CI will re-run all of the above to be sure.
```

---

## 5. The decisions we made (and why)

This is the part worth understanding — the rules aren't arbitrary.

### Client (Angular)

We installed the official **`angular-eslint`** toolchain via
`ng add @angular-eslint/schematics`. This is the standard, Angular-blessed way to lint
an Angular app. It wired up three things automatically:

1. A `lint` target in **`angular.json`**, so `ng lint` works.
2. A **`.eslintrc.json`** with sensible Angular defaults (component/directive selector
   naming, accessibility checks on HTML templates, TypeScript recommended rules).
3. The right **dependency versions for Angular 17** (ESLint 8, typescript-eslint 7,
   angular-eslint 17) — version matching matters here; mixing majors breaks things.

We then made **two deliberate tweaks**:

- **Added `"prettier"` to the `extends` list** (the `eslint-config-prettier` bridge
  from §2) so ESLint stops policing formatting.
- **Turned off `@typescript-eslint/no-explicit-any` for `*.spec.ts` files only.** In
  application code, `any` is a smell worth blocking. But in **tests**, casting like
  `of(null as any)` or `{ type: '@@UNKNOWN' } as any` is a normal, harmless way to feed
  a function a deliberately-wrong value. Blocking it would force ugly type gymnastics in
  tests for no real safety gain. Scoping the relaxation to spec files keeps production
  code strict.

### Server (Node)

Plain **ESLint** with the `eslint:recommended` rule set, configured for a CommonJS Node
environment (`require`/`module.exports`). On top of recommended we added a few rules
that catch classic Node mistakes:

- `no-unused-vars` (but it ignores names starting with `_`, the convention for
  "intentionally unused" — e.g. an Express `next` you don't call).
- `prefer-const` / `no-var` — modern JS hygiene.
- `eqeqeq` ("smart") — requires `===` except the safe `== null` idiom.

Test files get the **Jest globals** (`describe`, `it`, `expect`) via an `overrides`
block so the linter doesn't complain they're "undefined".

### A real bug the linter caught immediately

The first `ng lint` run wasn't clean — it found a genuine accessibility gap in the
**confirm dialog** ([confirm-dialog.component.ts](../client/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts)):
the modal could be dismissed by clicking the backdrop, but **keyboard users had no way
to close it**. That's exactly the kind of thing a linter is for.

We fixed it properly rather than silencing the warning:

- Added an **`Escape` key handler** (`@HostListener('document:keydown.escape')`) so
  keyboard users get the same "dismiss" affordance mouse users had.
- The backdrop click itself is a mouse-only _convenience_, so we suppressed the warning
  on that one line with an **inline `eslint-disable` comment plus a written
  justification**. That's the right way to handle a deliberate exception: make it
  explicit and explain it, don't disable the rule globally.

> **Lesson for new devs:** a lint warning is a _conversation_, not an order. Usually
> you fix the code. Occasionally the rule genuinely doesn't apply — in that case
> disable it **on that specific line, with a comment saying why**, never for the whole
> project.

---

## 6. How this plugs into CI

A lint script nobody runs is useless. So we wired all of this into the GitHub Actions
pipeline ([.github/workflows/ci.yml](../.github/workflows/ci.yml)). On every push and
pull request to `master`:

- The **server** job runs `npm run lint` _before_ its tests.
- The **client** job runs `npm run lint` _before_ its tests and build.
- A dedicated **format check** job runs `npm run format:check`.

If anything is mis-formatted or fails a lint rule, **the build goes red and the PR is
blocked**. That's the whole point: the rules are now _enforced_, not just available.

---

## 7. Editor setup (optional but recommended)

To get the most out of this, set up your editor once:

1. **Install the EditorConfig plugin** (VS Code: "EditorConfig for VS Code"). It reads
   [.editorconfig](../.editorconfig) and auto-applies indent/charset/line-ending rules
   as you type — so files are _born_ correct.
2. **Install the Prettier extension** and enable **"Format on Save."** Now formatting
   is invisible — you save, the file is tidy, you never think about it again.
3. **Install the ESLint extension.** It underlines problems inline while you code,
   instead of you discovering them at commit time.

With those three, the tooling fades into the background and just keeps your code clean
automatically.

---

## 8. FAQ / troubleshooting

**`npm run lint` fails on code I didn't touch.**
Someone may have committed before the linter existed. Run the fixers
(`npm run format`, `npm --prefix server run lint:fix`), then fix any remaining
human-judgment issues by hand.

**Prettier and my editor are fighting / reformatting on every save.**
Make sure your editor's Prettier extension is using the project's
[.prettierrc.json](../.prettierrc.json) (it should pick it up automatically). Don't set
conflicting format settings in your personal editor config.

**Can I just disable a rule I don't like?**
Prefer a line-level `// eslint-disable-next-line <rule> -- <reason>` with a reason over
turning a rule off globally. Global changes affect the whole team and should be
discussed, not done quietly.

**Why didn't `npm run lint` auto-fix my problem?**
`lint` is intentionally read-only so it's safe to run anywhere (including CI). Use
`npm run format` for style and the `lint:fix` scripts for auto-fixable lint rules.
