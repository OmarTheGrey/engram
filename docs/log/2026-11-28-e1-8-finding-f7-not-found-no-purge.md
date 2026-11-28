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
  - packages/core/src/plane/offboard.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** E18-F7: an erasure whose read finds no record, because a stale writer's settle deleted it a moment before, records the content as left in the store; adoption then refuses a record under the erased id holding that content without purging it.

**Why.** Found by the replay (1 of 200 traces); scenario `e18NotFoundNoPurgeTest` diverges at step 23.

**Result.** The model refuses and purges. The not-found path, built for a moved store, also fires on a race, so another writer's put-back of erased content stays until that writer's settle removes it.

**Consequence.** For card E1.7 and the residue check (X19): purge under an erased id whatever the content clause says.
