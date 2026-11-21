---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - specs/commit.qnt
  - packages/core/src/plane/adopt.ts
  - packages/core/src/plane/write.ts
supersedes: none
---

**What.** A race the model shows outside the four properties: adoption's purge of a record under a swept id can delete the store record of a later committed write under that id.

**Why.** A write under a swept id is allowed (write.ts planeRefusal checks lastErasure only), while adoption refuses such an id and then deletes the record outside the lock (adopt.ts purgeOutcome). A write that commits between adoption's deny and its delete loses its record.

**Result.** The scenario test good::sweptIdPurgeRaceTest ends with item b projected and its store record gone, with no property failing. The code was not changed (out of the card's scope).

**Consequence.** For the lead: either refuse writes under swept ids, or check under the lock before the purge's delete. A backlog row is the natural home.
