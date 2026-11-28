---
date: 2026-11-28
author: claude-agent
type: failure
card: D4
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane.ts
  - packages/core/test/unit/distill/drift.test.ts
supersedes: none
---

**What.** The test "a malformed replay or environment is refused before the log is touched" failed on its first run.

**Why.** `createPlane` wired `revalidate` as a plain arrow, so the InvalidCallError was thrown synchronously instead of rejecting the promise, as every other Plane method does through an `async` wrapper.

**Result.** Wired as `async`, like `promote`; the file then passed 19 of 19 (the acceptance block waiting for its fixture), later 22 of 22.

**Consequence.** None beyond the fix.
