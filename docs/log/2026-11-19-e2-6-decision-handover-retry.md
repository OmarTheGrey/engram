---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/plane/offboard.ts
  - packages/core/test/unit/plane/cross-handle.test.ts
supersedes: none
---

**What.** A stale handover is refused (`engram/offboard/conflict`), the store put back, and the item handed over again as it now stands, at most four times.

**Why.** The handover's intent outlives the version it read: the successor should get the item with the owner's latest change, such as a grant removal, rather than the leaver keeping it until a rerun.

**Result.** R4: the removal is kept, the successor owns version 3, and the log holds one conflict and versions 1, 2 and 3 once each.

**Consequence.** An item that keeps changing is left with the leaver and named by its conflict events.
