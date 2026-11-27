---
date: 2026-11-28
author: claude-agent
type: failure
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/plane/promote.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** After main (E9.9) was merged, invariant 2's promotion check failed. It compared the promoter's answer with the raw log events.

**Why.** Since RD1, `Plane.promote` answers with its events as the promoter is shown them (`disclosedEvent`). E9.9's generator now yields an owner's self-grant promoted by another actor, so the answer's item has fewer grants than the log's.

**Result.** The orchestrator changed the test, and this entry records the review: the log events go through `disclosedEvent` over the projection after the promotion and `accessTime(db, when)`, with `when` the promotion's own time, which is the view `promote.ts` builds. A raw answer would still differ from the shown events whenever one is narrowed, so the check still catches a mismatch. `make test-invariants`: 21 passed.

**Consequence.** The invariant now checks the answer against the log as the promoter may see it.
