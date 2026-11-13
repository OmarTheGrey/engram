---
date: 2026-11-13
author: claude-agent
type: failure
card: none
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/adapters/test/plane/offboard-files.test.ts
  - packages/core/test/unit/plane/read-erasure.test.ts
supersedes: none
---

**What.** An adversarial recheck of PR #41 found its adoption skip and its read re-check wrong.

**Why.** Adoption skipped any erased id, but the files adapter derives an imported id from the file name, so a successor's adoption and other people's same-named folders were hidden forever, rewrites were never governed, no event was written, and an adoption queued behind the offboarding wrote the erased bytes back. The read dropped erased items after scoring and the limit, leaving short reads and deflated relevance, and bound one parameter per item.

**Result.** Adoption now refuses, in the write queue with a deny event, only a record holding content erased and left in the store. The read re-checks the projection under its lock with a parameter-free query before filtering, scoring and the limit. Both were broken on purpose to show their tests fail.

**Consequence.** Letta's permanent errors and a surface for `left_in_store` are backlogged.
