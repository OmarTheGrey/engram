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
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** Finding V3-4: the dogfood report accepted planted narrowings and withdrawals that changed content, removed nothing, or named no adoption.

**Why.** It judged them only when they changed what the grants admit.

**Result.** The four planted cases of probe Q3 each report one violation now, and did not before.

**Consequence.** None.
