---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
supersedes: none
---

**What.** The first run of the report's tests failed: the synthetic log's day helper produced `2026-11-32`.

**Why.** The helper started on 20 November and added up to 20 days; `Plane.changeGrants` refused the invalid expiry with `InvalidCallError`.

**Result.** All 16 tests failed in setup; the days now start on 10 November, so day 20 is the 30th.

**Consequence.** Nothing beyond the fix.
