---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - make test-invariants
supersedes: none
---

**What.** Invariant 1 gains a walk across two handles over one log and store, interleaved by a fast-check scheduler at every store call, with one offboarding; nothing in the file was weakened.

**Why.** The card asks that a random interleaving of two handles' operations, offboarding included, never return erased content to any reader.

**Result.** 300 runs pass in about fourteen seconds; on main the property fails after 40 runs (an erased item projected again). 4000 runs under two other seeds, with walks up to ten operations, also pass. Guards require erasures, granted reads and stale refusals.

**Consequence.** `make test-invariants` runs six tests; the lead's second review is asked for.
