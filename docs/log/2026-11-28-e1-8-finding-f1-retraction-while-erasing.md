---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/model/replay.ts
  - specs/replay.qnt
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** E18-F1: adoption retires a projected item the store no longer lists (or whose record it refused), and does so while the item's person scope is being erased.

**Why.** Found by the replay: 12 of 200 traces diverge after such a retraction; scenario `e18RetractionWhileErasingTest` diverges at step 13.

**Result.** The retirement is an allowed change, so a stale writer's settle goes round again where the model appends its deny. The closing transaction of `adoptStoreItems` checks staleness but not `erasureOpen`, against the header's rule that adoption into an erasing scope is refused.

**Consequence.** For card E1.7 or the lead: refuse the retraction while the scope is erasing, or model retraction.
