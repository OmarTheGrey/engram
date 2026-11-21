---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: limitations
pillar: research
hypothesis: H5
evidence:
  - packages/server/src/workspace.ts
  - packages/core/src/plane/read.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** `engram serve` builds its plane without `retrieval: { pipeline: "core", limit }`, so C5's reads over `/api/v1/read` rank by the store's search and return every admitted hit, while C2 here, and the runner's C2 and C5, rank by core's `retrieve` cut to the read limit (coreReadPlane).

**Why.** The runner makes C5 equal to C2 plus the read filter; through the server it is not, so C5 minus C2 on tau2 would also measure a retrieval difference.

**Result.** The shim cuts C5's read to the read limit in rank order; the ranking itself still differs. On the fixture slice the two orders agree (two and three items).

**Consequence.** Before card X11 runs H5, `engram serve` needs a way to take the core pipeline and the limit (a server card), or the launcher hosts C5's plane itself.
