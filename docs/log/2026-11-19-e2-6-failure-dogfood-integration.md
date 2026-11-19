---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: implementation
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/unit/dogfood-report.test.ts
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** After the rebase onto main (`dc8e9b6`), card E9.5's drift test (E95-12) failed: the dogfood report's fixed list lacked this card's rule ids, and its replay did not know a withdrawal.

**Why.** This branch began before card E9.5 merged, and the review fix pass added ids and an item-changing event without checking the report that replays logs.

**Result.** `every engram/ rule id core names is on the list` failed on the rebased head and passes after the integration; `packages/core/test/unit/dogfood-cross-handle.test.ts` covers the replay.

**Consequence.** A new rule id or an item-changing event in core needs the dogfood list and the oracle in the same change.
