---
date: 2026-11-28
author: claude-agent
type: finding
card: E2.21
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Mutation checks of part 2's tests, with a script that plants each mutant and restores the file.

**Why.** The brief asks for at least one key test per deliverable to be mutation-checked.

**Result.** `write-grants.test.ts` kills all five: the cap made inclusive (3 tests fail), the cap ignored (5), the first-write rule dropped (4), the promotion not exempt (3), the grant change uncapped (1). Invariant 2 kills the cap ignored and the first-write rule dropped, but not the inclusive boundary: its draws put expiries years from the limit. The oracle's own boundary has unit tests (`oracle-grants.test.ts`: exact second, nanosecond fraction, leap year).

**Consequence.** No mutant was added to `fixtures/mutants/`: a new one would move the audit row's bytes, and the boundary is held by the unit tests. A later card may add one with a draw relative to the write time.
