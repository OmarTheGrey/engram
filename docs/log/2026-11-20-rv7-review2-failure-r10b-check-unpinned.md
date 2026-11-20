---
date: 2026-11-20
author: claude-agent
type: failure
card: RV7
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/plane/write-grants.test.ts
supersedes: none
---

**What.** Review finding RV7-R10b: nothing pinned the move refusal's `check: "move"`.

**Why.** `Plane.write` returns the event, which carries no check, so the earlier test saw only the rule id.

**Result.** The co-holder move test now calls `evaluateWrite` on the same input and asserts the check is `move`. Changing it back to `version` fails that test.

**Consequence.** Nothing else.
