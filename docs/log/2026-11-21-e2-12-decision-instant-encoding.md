---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.12
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/policy/cedar.ts
  - packages/core/src/time.ts
supersedes: none
---

**What.** An instant is exported as a Cedar record of two Longs, epoch seconds and nanoseconds, compared lexicographically, not as Cedar's `datetime`.

**Why.** Cedar's `datetime` keeps milliseconds, while Engram compares timestamps at full precision (`time.ts`, decision D7), and the generators draw `.0001` and `.0009`, which a millisecond cannot tell apart. Two Longs are exact to the nanosecond and a ttl adds whole seconds to the first, as `addSeconds` does.

**Result.** Validity windows, ttls and grant expiries agree on every generated request, the colliding instants included. An instant finer than a nanosecond is refused by the encoder (`CedarExportError`), an excluded class the test names. Dropping the nanoseconds is caught by seven failing tests.

**Consequence.** The exported text reads less naturally than `datetime` would. A reader who wants `datetime` can have it only by accepting millisecond disagreements.
