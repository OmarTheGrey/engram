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

**What.** E18-F1: adoption retires a projected item the store no longer lists (or whose record it refused), and does so even while the item's person scope is being erased.

**Why.** Found by the replay. With status compared, 51 of the 200 traces first diverge where an F1 mark (a retraction) names the diverging item, at or before that step; scenario `e18RetractionWhileErasingTest` diverges at step 12.

**Result.** The model has no retraction: the item stays live there and is retired in the code, and the retirement is an allowed change that sends other handles' settles round again. The closing transaction of `adoptStoreItems` checks staleness but not `erasureOpen`, against the header's rule that adoption into an erasing scope is refused.

**Consequence.** For card E1.7 or the lead: refuse the retraction while the scope is erasing, and model retraction.
