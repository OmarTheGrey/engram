---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Finding V3-3: a narrowing removed a grant the owner had removed and then deliberately added again after the stale adoption.

**Why.** The narrowing compared only against the version before the adoption.

**Result.** Probe Q3b failed before the fix and passes after.

**Consequence.** See the decision on narrowing.
