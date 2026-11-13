---
date: 2026-11-06
author: claude-agent
type: failure
card: E8.9
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/simulate.ts
  - packages/core/test/unit/plane/simulate.test.ts
supersedes: none
---

**What.** The self-review before opening the PR found that a workload's promote steps took any string as an item id and a target scope, and its retain steps any string as a scope.

**Why.** The shape checked them as strings, so a malformed one passed `checkWorkload` and failed half way through the replay, after the baseline had run.

**Result.** They are `Id` and `Scope` now, so such a workload is refused before anything runs; a test covers the three cases.

**Consequence.** None for valid workloads; the OpenAPI document names the formats.
