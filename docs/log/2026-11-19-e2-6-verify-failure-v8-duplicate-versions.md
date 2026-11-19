---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/cross-handle-verify.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** Verification finding V-8: an item got three version-2 events, the owner's removal, the stale adoption and the withdrawal.

**Why.** The withdrawal took the higher of the restored and current versions, which equal each other when the adoption kept the version.

**Result.** Every version recovery writes is now one above the current; V3's test checks that versions never fall and recovery always raises them.

**Consequence.** An adoption may still repeat a version, as ADR 0005 lets an owner's hand edit do.
