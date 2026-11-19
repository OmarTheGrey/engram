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
  - packages/core/test/unit/plane/cross-handle-review.test.ts
supersedes: docs/log/2026-11-19-e2-6-decision-handover-retry.md
---

**What.** After its fourth conflicting attempt a handover appends one deny, `engram/offboard/not-handed-over`, names the item in `not_reached`, counts it in the report's reason, and the last conflict says no further attempt is made; the report stays allowed.

**Why.** The rest of the offboarding stood; rerunning it hands the item over, as for a store failure.

**Result.** RV2 passes; dropping the deny fails it.

**Consequence.** None.
