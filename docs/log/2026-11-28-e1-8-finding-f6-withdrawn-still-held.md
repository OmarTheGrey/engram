---
date: 2026-11-28
author: claude-agent
type: finding
card: E1.8
chapter: discussion
pillar: twin
hypothesis: none
evidence:
  - specs/replay.qnt
  - packages/core/test/model/trace-replay.test.ts
  - packages/core/src/plane/commit.ts
supersedes: none
---

**What.** E18-F6: a withdrawal to nothing leaves the item retired, and the code goes on treating it as the plane's item.

**Why.** Found by the replay (1 of the 200 traces is attributed to it, and seed 12's trace 402); scenario `e18WithdrawnStillHeldTest` diverges at step 19.

**Result.** A stale writer's settle puts the retired item back into the store (`wanted` returns it), so the stale bytes the withdrawal undid return as its record; adoption takes its kind as the ceiling of a new record under the id (model where the model gives import). The erasure's side of the same status is E18-F8.

**Consequence.** For card E1.7: `wanted` should return no item for a retired one, or the model should keep status.
