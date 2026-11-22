---
date: 2026-11-21
author: claude-agent
type: finding
card: E2.12
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/time.ts
  - packages/core/src/policy/retention.ts
  - packages/core/src/policy/cedar.ts
supersedes: none
---

**What.** `addSeconds` returning null for an expiry past 9999-12-31T23:59:59 (an item that never expires) is unobservable at read: any such end is after every instant a timestamp can write, so a plain comparison decides the same.

**Why.** The first export bounded the ttl sum by that last second, mirroring the null. A mutation removing the bound survived the differential test, which drew items starting near year 9999.

**Result.** The bound was an equivalent mutant and was removed from the export, with the reasoning in its comment. The evaluator is unchanged.

**Consequence.** Nothing for the evaluator; the null still matters to `itemExpiry`'s callers that report the expiry instant.
