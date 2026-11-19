---
date: 2026-11-19
author: claude-agent
type: failure
card: L3
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/unit/lint/model.test.ts
  - packages/core/test/unit/plane/lint-model.test.ts
supersedes: none
---

**What.** Two of L3's own tests failed on first run because their expectations were wrong, not the code.

**Why.** Tests were written before the implementation, by hand.

**Result.** The neighbour test's world shared letters between every pair, so item 7 chose item 1 among its nearest; it was rebuilt so that items share terms only with item 1. The plane test listed the flagged items of five pairs in the wrong order and counted 7 judgments for 6 units.

**Consequence.** Both were corrected before the implementation was trusted; each now fails when its rule is broken.
