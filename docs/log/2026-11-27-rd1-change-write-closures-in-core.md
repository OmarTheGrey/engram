---
date: 2026-11-27
author: claude-agent
type: change
card: RD1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/supersede.ts
  - packages/server/src/routes.ts
  - packages/core/test/unit/plane/supersede.test.ts
  - packages/server/test/supersede.test.ts
supersedes: none
---

**What.** `writeClosures` moved from the server into core (`supersede.ts`), and it answers with each close, write and event as the actor is shown it; the supersede route only calls it (review finding 6).

**Why.** The route built the disclosure itself, so a second surface calling the old server function would have answered with every grant and lineage id.

**Result.** The route's answer has the same shape (`make api-check` clean). A new core test: a grantee's accepted close comes back with its own grant only and no hidden ancestor, and the owner's whole. Returning the raw answer fails it and the server's supersede disclosure test. The server's L6-3 store-refusal test, now on core's function, passes.

**Consequence.** Any surface that applies a supersession plan calls core's `writeClosures`.
