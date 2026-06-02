# 2.b — What You Should *Not* Claim

> A detailed expansion of the "What you should not claim" note in
> [INTERVIEW_PLAYBOOK.md §2](./INTERVIEW_PLAYBOOK.md#2-why-this-project-is-the-right-one-to-showcase),
> with a deep focus on the most common self-inflicted wound: **bragging about
> solo work instead of framing it as context.**

The single most useful idea here: **one overclaim taxes everything else you
say.** The moment an interviewer catches a claim that doesn't survive scrutiny —
"production-ready" with no auth, "comprehensive tests" with three spec files —
they silently apply a discount to *every* later claim, including the true ones.
Underclaiming slightly and then over-delivering does the opposite: it builds a
credibility surplus you spend later when you say something genuinely impressive.

This doc is the catalogue of claims to avoid on *this* project, why each backfires,
and the honest reframe that lands better.

---

## Table of contents

1. [The principle: calibrated honesty beats confidence](#1-the-principle-calibrated-honesty-beats-confidence)
2. [The big one — "I built every line solo" (as a brag)](#2-the-big-one--i-built-every-line-solo-as-a-brag)
3. ["Production-ready" → "production-shaped"](#3-production-ready--production-shaped)
4. [Other overclaims to avoid on this project](#4-other-overclaims-to-avoid-on-this-project)
5. [The reframe pattern (how to convert any gap into a credibility win)](#5-the-reframe-pattern-how-to-convert-any-gap-into-a-credibility-win)
6. [Quick reference: ❌ → ✅](#6-quick-reference----)

---

## 1. The principle: calibrated honesty beats confidence

Senior interviewers are, professionally, sceptics. Their day job is reviewing
other people's work and finding what's wrong with it. So they listen to a project
pitch the way a code reviewer reads a PR description — scanning for the gap between
what's claimed and what's true.

Two failure modes:

- **Overclaiming** ("it's production-ready", "fully tested", "secure"). Each one
  is a tripwire. When it trips, you don't just lose *that* point — you lose the
  interviewer's trust in your self-assessment, which is the thing they're actually
  evaluating. A senior who can't see the gaps in their own work is a senior who
  ships gaps.
- **Underclaiming / apologising** ("I know the backend isn't realistic, but…").
  This wastes credibility you've earned and reads as insecurity.

The target is the narrow band between them: **say exactly what's true, name the
limits before you're asked, and let the honesty itself be the impressive part.**
Calibration *is* the senior signal — more than any single feature.

---

## 2. The big one — "I built every line solo" (as a brag)

This is the claim the source note singles out, and it's worth the most detail
because the *same fact* can be your strongest or weakest moment depending purely
on framing.

### Why bragging about it backfires

Saying *"I built every line of this myself"* as a flex creates three problems at
once:

1. **It's not actually impressive on its own.** Of course you built it solo — it's
   a take-home. Presenting an expectation as an achievement signals you don't know
   what the bar is.
2. **It invites the question you don't want.** "Built it all yourself" makes the
   interviewer wonder *"so who caught your mistakes?"* — and on a solo project, the
   honest answer is "no one." If you led with the brag, that follow-up lands as a
   weakness you walked into.
3. **It signals the wrong instinct.** Senior engineering is a *team* sport —
   review, mentoring, shared standards. A candidate who frames solo heroics as the
   highlight is advertising the opposite of what a senior role wants.

### Why it's actually valuable — as *context*

The solo nature isn't an achievement; it's a **constraint** — and what you did
*about* the constraint is the achievement. On a real team, the safety net is **peer
code review**: a second pair of eyes that catches your blind spots before they
ship. A solo take-home has no such net. So the senior move is to **build your own
net** — and to be able to show you did:

> *"There was no code-review safety net on this — so after the first pass I wrote a
> senior-dev review of my own work, listing every gap, every untested layer, and
> every architectural smell I'd flag in someone else's PR. Then I shipped the
> top-priority fixes I'd found in the next commits."*

That sentence does four things a brag can't:

| What it shows | Why it's the senior signal |
|---|---|
| You know review is where quality comes from | You don't think solo heroics = quality |
| You can review *your own* code critically | Self-awareness — the hardest senior skill |
| You acted on what you found | Follow-through, not just analysis |
| You're honest about gaps unprompted | The interviewer can trust your self-assessment |

### The proof exists in this project

This isn't a rhetorical move — there's an artifact to point at:

- **The self-review:** [README §10 — "Senior-dev review: what's missing"](../README.md#10-senior-dev-review-whats-missing)
  ranks the gaps by blast radius (Critical / Should-fix / Nice-to-have) and ends
  with "the five things I'd actually fix first."
- **The follow-through:** the gaps flagged as highest priority (backend service
  tests, the `MAX_PAGE_SIZE` clamp + its justification) were shipped in subsequent
  commits — exactly what the framing promises.

So when you say *"I reviewed my own work and shipped the gaps,"* you can open the
README §10 and the commit history to back it. A claim with an artifact behind it
is unshakeable.

### How to say it (and how not to)

> ❌ *"I built this entire full-stack app by myself, every line."*
>
> ✅ *"Solo project, so no code-review safety net — which is why I wrote my own
> senior-dev review afterwards and shipped the gaps I found in follow-up commits.
> The review's in the README if you want to see what I flagged."*

The first is a flex that invites "who reviewed it?". The second *answers* that
question before it's asked, and turns the absence of a reviewer into evidence of
ownership.

---

## 3. "Production-ready" → "production-shaped"

The other claim the note calls out. It's tempting because the project *looks*
polished — but it's false, and the falseness is easy for an interviewer to expose.

### Why "production-ready" is a tripwire here

The project is missing several things a real production system at a bank must
have, all documented in [README §10](../README.md#10-senior-dev-review-whats-missing):

- **No authentication** — every audit entry records `actor: 'admin'` because there's no user concept.
- **In-memory store** — data is wiped on restart; there's no database wiring.
- **No CI pipeline**, no rate limiting, no monitoring, no health checks, no container.

Claim "production-ready" and the very first probing question ("how do you handle
auth?" / "what's your deployment story?") detonates it — and now every *other*
claim is suspect.

### The honest, stronger word: "production-shaped"

> *"It's production-**shaped**, not production-**ready**. The layering, the audit
> log, the validation on both sides, the responsive design and the accessibility
> pass all match what would ship at a bank. The plumbing — auth, a real database,
> CI, monitoring — is deliberately out of scope for a take-home, and I've got that
> list written down."*

"Production-shaped" is precise: it claims the *architecture and craft* match
production standards while being upfront that the *operational plumbing* doesn't.
It's both more honest and more impressive than "production-ready", because it
proves you know the difference — which is itself a senior distinction.

---

## 4. Other overclaims to avoid on this project

The same calibration applies to four more tempting claims:

### "Comprehensive / full test coverage"

It isn't. There are **4 frontend unit specs, 2 backend Jest suites, and 4 Cypress
flows** — and the validators, controllers, and middleware have **no direct unit
tests** (covered only transitively via Cypress).

> ✅ *"Coverage is concentrated on the two services where a regression would
> silently corrupt data — the audit diff and the cascade delete. The validator and
> controller gap is the next backlog item; I flagged it in my own review."*

That reframes "30-ish tests" as "tests on the *right* things" — risk-based, not
vanity-percentage.

### "Fully accessible" / "WCAG AAA"

Claim the level you actually hit. The project targets **WCAG 2.1 AA on interactive
surfaces** with a documented audit — not blanket AAA, and there's no formal
automated contrast scan (visual inspection only, noted in README §10).

> ✅ *"I did an a11y pass to AA on the interactive surfaces — focus management,
> ARIA, keyboard paths — and documented what each change announces to a screen
> reader. A formal axe-core contrast audit is still on the list."*

### "Responsive" (with no specifics)

The word alone means nothing; lots of broken apps are called "responsive."

> ✅ *"Responsive across phone, tablet, desktop and 4K — tables drop columns and
> the container scales at specific breakpoints, not just `max-width: 100%`."*

### "Secure" / "scalable"

Don't claim either as a finished property. The project has *good security
habits* (input sanitisation, problem-details, validation on both sides) but **no
auth and no rate limiting**; it's *built to scale* (stateless once the store moves
to Postgres) but hasn't been load-tested.

> ✅ *"Good security habits — sanitisation, validation both sides, correlation-id
> tracing — but auth and rate limiting are explicit gaps, not claims I'd make."*
> *"It's structured to scale horizontally once the store is externalised, but I
> haven't load-tested it, so I won't claim a number."*

---

## 5. The reframe pattern (how to convert any gap into a credibility win)

Every entry above follows one repeatable move. Internalise the *pattern* and you
can handle a gap you didn't prepare for:

```
1. State the limit plainly        ("there's no auth")
2. Name why it's acceptable here  ("out of scope for a take-home")
3. Show you see the real version  ("in production it'd be JWT middleware
                                    populating req.user")
4. Point to where you wrote it down ("it's item 1 in my self-review")
```

Steps 3 and 4 are what flip it: anyone can admit a gap (step 1–2); a senior
demonstrates they **already know the fix and already documented it**. The gap stops
being a weakness and becomes proof you think like the person who'd own the fix.

The universal fallback when caught without an answer:

> *"Honestly, I don't know — but here's how I'd find out."*

That single sentence outperforms any bluff. Interviewers are testing how you behave
at the edge of your knowledge, and calm honesty is the correct behaviour.

---

## 6. Quick reference: ❌ → ✅

| ❌ Don't claim | ✅ Say instead |
|---|---|
| "I built every line solo" *(brag)* | "No code-review net — so I wrote my own senior-dev review and shipped the gaps I found." |
| "It's production-ready" | "Production-**shaped** — architecture/craft match prod; auth, DB, CI are out-of-scope plumbing." |
| "Comprehensive test coverage" | "Tests concentrated on the two highest-blast-radius services; validator/controller gap is flagged." |
| "Fully accessible / AAA" | "WCAG **AA** on interactive surfaces, documented; formal contrast scan still on the list." |
| "It's responsive" | "Phone → tablet → desktop → 4K; columns drop and the container scales at set breakpoints." |
| "It's secure / scalable" | "Good security *habits*; auth + rate limiting are explicit gaps. Structured to scale, not load-tested." |

**The throughline:** name the limit before you're asked, show you know the real
version, and point to where you wrote it down. Calibrated honesty isn't modesty —
it's the most senior thing you can demonstrate in the room.

---

*See also: [WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md](./WHAT_MAKES_IT_CREDIBLE_TO_LEAD_WITH.md)
(the positive companion — what you *should* lead with),
[INTERVIEW_PLAYBOOK.md §7](./INTERVIEW_PLAYBOOK.md#7-the-messy-parts-what-didnt-work)
(the messy parts), and the
[README self-review](../README.md#10-senior-dev-review-whats-missing).*
