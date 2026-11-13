---
date: 2026-11-13
author: claude-agent
type: failure
card: E9.7
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
supersedes: none
---

**What.** The first cross-backend test written in the review asserted that no explanation row is left after offboarding, and failed on both backends with 2 rows.

**Why.** Sam's read returned the two role items as well as Dana's granted note, and their rows rightly stay; only rows of erased items are removed.

**Result.** The test now counts rows of the erased items only, and passes on SQLite and Postgres.

**Consequence.** Nothing in the code; the acceptance test's own count of zero holds only because its fixture never reads.
