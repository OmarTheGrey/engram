---
date: 2026-11-21
author: claude-agent
type: decision
card: X14
chapter: design
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/redteam/run.ts
  - packages/core/src/plane/adopt.ts
supersedes: none
---

**What.** The read route writes each record straight to the fake store in the reader's own person scope, claiming the cell's kind, and adopts it with core's `adoptStoreItems` as the scope's owner before `Plane.read`.

**Why.** That is where a store's own memories live and how every surface adopts them (`plane/before-read.ts`); placing content outside the plane is the attack being measured, so this is the one adapter call outside the Plane besides C2's.

**Result.** Adoption lowers a claim to the least trusted of it and `import`: claims of user and document are recorded as import, tool, model and external stay.

**Consequence.** A team-scope store would need a second adoption call; not run. Cost if wrong: the read route's cells for shared scopes.
