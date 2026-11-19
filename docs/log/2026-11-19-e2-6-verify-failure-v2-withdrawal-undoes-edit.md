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

**What.** Verification finding V-2: a stale writer's withdrawal put the item back over the owner's hand edit, adopted after the stale bytes.

**Why.** The review pass withdrew whenever every allowed change since the stale adoption was an adoption, and the owner's hand edit arrives as one.

**Result.** Probe V2 failed before the fix and passes after.

**Consequence.** See the decision on withdrawal and narrowing.
