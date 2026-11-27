---
date: 2026-11-25
author: claude-agent
type: failure
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
  - packages/core/src/visible.ts
supersedes: none
---

**What.** The first draft matched the grant-change gate's events by the prefix string `engram/grant/`. The dogfood report's rule-id test failed: it reads every `engram/` string core names as a rule id, and the prefix is on no list.

**Why.** E95-12 requires each rule id core names to come from the fixed list.

**Result.** `visible.ts` now holds a set of the gate's seven id constants, and only `update` events are matched, so a write the grant rule refuses keeps its reason. `dogfood-report.test.ts` passes, 47 tests.

**Consequence.** None beyond the fix.
