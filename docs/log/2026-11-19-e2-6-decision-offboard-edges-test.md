---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/offboard-edges.test.ts
supersedes: none
---

**What.** The review test of PR #33 that a store failure during handover appends one event now expects two: the erasure's mark, then the handover's refusal.

**Why.** The mark is appended before any store call by design; the test's point, that nothing is erased and the person scope is intact, is kept and asserted as before.

**Result.** The test passes on both backends with the mark checked by its policy id.

**Consequence.** None.
