---
date: 2026-11-25
author: claude-agent
type: failure
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** After the change, invariant 5 failed: a grantee's read returned one grant where the item's latest event carries two (seed -666826730).

**Why.** The invariant asserted that a read returns the latest event's grants whole. That was the behaviour item 36 retires, not a defect of the new code.

**Result.** The assertion now compares the returned grants with the latest event's as the reader is shown them, computed in the test from the oracle's own `readable` and `patternCovers`, not core's rule: all of them to an owner who reads the scope, else those naming the reader. It still catches a grant that comes back once removed. `make test-invariants`: 3 files, 21 tests passed.

**Consequence.** The invariant now also pins item 36.
