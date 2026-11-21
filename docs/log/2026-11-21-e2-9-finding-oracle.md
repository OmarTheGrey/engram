---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.9
chapter: limitations
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - "make test-invariants"
supersedes: none
---

**What.** The invariants' oracle (`packages/core/src/oracle.ts`) does not model the content guards, and the invariant generators never set `content_guards`.

**Why.** The card's files leave the oracle alone, and the registered presets have no block, so the seven invariants exercise exactly what they did.

**Result.** `make test-invariants`: 8 of 8 tests pass. A policy with the guards on is covered by the unit and Plane tests of `secrets.test.ts`, not by the property tests.

**Consequence.** A card that registers an arm with the guards on (R2, X14) should teach the oracle the stage first, or the invariants say nothing about it.
