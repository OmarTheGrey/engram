---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/plane/retention.ts
supersedes: none
---

**What.** A write denied because its evictions would need a more trusted victim uses the same rule id, `engram/write/downgrade`, with its own reason.

**Why.** ADR 0040 names one rule for the option and only says the eviction case is denied "with the reason".

**Result.** Reasons differ: `rewrites` or `retires item`, or `would have to evict an item more trusted than it`.

**Consequence.** If the lead wants two ids, `budgetRefusal` takes a new constant.
