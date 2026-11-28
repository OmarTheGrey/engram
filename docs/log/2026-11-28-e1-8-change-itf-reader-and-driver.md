---
date: 2026-11-28
author: claude-agent
type: change
card: E1.8
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/model/itf.ts
  - packages/core/test/model/replay.ts
  - packages/core/test/model/trace-replay.test.ts
supersedes: none
---

**What.** A small ITF reader (`itf.ts`: bigints, maps, sets, tuples, records, gzip) and a driver (`replay.ts`) that replays a trace on three Plane handles, each its own SQLite connection to one log, over one fake store, with an injected clock and ids.

**Why.** Card E1.5 checked the model against itself; nothing checked that the code follows it. `@firfi/quint-connect` stays unusable.

**Result.** Every store call stops at a point; a model step runs a handle from one point to the next; a step the code runs in the previous one's stretch drives nothing. After each step with no stretch open, the projection, the store records, the open marks, the trail of decisions and which handles are busy are compared. `make test-one T=packages/core/test/model/trace-replay.test.ts`: 220 tests passed.

**Consequence.** Card E1.7's fix is checked on both sides by the same replay.
