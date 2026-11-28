---
date: 2026-11-28
author: claude-agent
type: finding
card: D4
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/read.ts
  - packages/core/src/plane/read-reason.ts
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Three things D4 leaves for the lead or a later card.

**Why.** Each needs a change outside the card's files or to a registered surface.

**Result.** (1) A read answer and `engram explain` carry returned items only; a retired item is a `not_active` count in the read reason, so showing "retired, with its reason" there needs a per-item withheld field, an API change (`make api`) that would touch registered read reasons if done broadly. (2) Invariant 2's oracle forbids promoting a retired source; the property test never calls `Plane.revalidate`, so a restore (a `promote` allow on a drift-retired item) is not judged by it, and a dogfood log holding one would need the oracle to know `<policy>/drift/restored`. (3) A success rate smoothed across re-validations stays later work (the ADR 0011 amendment).

**Consequence.** Each is a candidate follow-up card; none moves a registered result.
