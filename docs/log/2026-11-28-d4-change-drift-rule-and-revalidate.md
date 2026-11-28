---
date: 2026-11-28
author: claude-agent
type: change
card: D4
chapter: implementation
pillar: distill
hypothesis: none
evidence:
  - packages/core/src/distill/drift.ts
  - packages/core/src/plane/revalidate.ts
  - packages/core/test/unit/distill/drift.test.ts
  - "make test-one T=packages/core/test/unit/distill/drift.test.ts"
supersedes: none
---

**What.** `distill/drift.ts` (when a re-validation is due, and whether it retires) and `Plane.revalidate`, which judges a presented re-validation replay and commits one event.

**Why.** Card D4: the `replay-drift` and `environment-changed` triggers in `lint.ts` had no producer, and an admitted procedure could never leave active.

**Result.** Due on a changed environment hash or the policy's period since the last validation; D3's replay checks unchanged (item, content hash, split, replay_n, seeds 1 to 3); retired below `replay-drift.success-floor` after `replay-drift.min-trials`, kept otherwise, restored when a drift-retired version passes the admission rule and the floor again. Each refusal (off, not due, not user-sourced, not a member, wrong status, thresholds missing) is one deny event. The acceptance file passes 22 of 22 tests.

**Consequence.** Off unless a policy sets `procedures.drift`; no registered preset does.
