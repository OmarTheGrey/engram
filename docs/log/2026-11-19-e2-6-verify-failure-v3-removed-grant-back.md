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

**What.** Verification finding V-3: a removed grant stayed back for good when the owner changed the item after the stale adoption reintroduced it.

**Why.** Recovery did nothing once a non-adoption change followed the adoption, so the reintroduced grant survived.

**Result.** Probe V9 failed before the fix and passes after; mutant M2 now dies.

**Consequence.** See the decision on withdrawal and narrowing.
