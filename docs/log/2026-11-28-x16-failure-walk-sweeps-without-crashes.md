---
date: 2026-11-28
author: claude-agent
type: failure
card: X16
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/plane/offboard.test.ts
supersedes: none
---

**What.** To kill `I1H-store-delete-skipped` in the two-handle walk, I tried this rule: a walk with no crashed writer appends no `engram/offboard/swept` event. It failed on the unmutated code.

**Why.** Crash-free walks also sweep records, for reasons other than a skipped delete. The walk's adoptions and its refused writes under an erasing scope leave records that the sweep then deletes. The rule was wrong, not the code.

**Result.** The check was removed from the walk. Its plain form went into the offboarding acceptance test: after a single offboarding of seeded items, the log holds no swept event. With the mutant applied in a scratch copy, that test fails (1 of 6); unmutated, it passes.

**Consequence.** The mutant still survives its invariant test, by design. Its note names the unit test that kills it.
