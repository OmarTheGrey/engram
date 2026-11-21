---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/plane.ts
  - packages/bench/src/tau2/memory.ts
  - packages/runner/src/conditions.ts
supersedes: docs/log/2026-11-21-b11-decision-conditions.md
---

**What.** C1, C2 and C5 follow the runner: CONDITION_TABLE, statedPreset and NO_STORE for the keys, ungoverned tools and read for C2, coreReadPlane for C5. C2 is the launcher's loopback store with no plane, over a fresh files adapter. C5 is no longer a spawned `engram serve`: it is its app, run in process with @engram/server's `listen` over a fresh files adapter, as card B7 runs MERIT's. Its reads use the core pipeline and the limit, its clock is memory_time and its ids are seeded.

**Why.** Reviews B11-1 to B11-3. A spawned server takes none of those options. The card's "engram serve on loopback" still holds: the shim calls the same /api/v1 routes over HTTP.

**Result.** @engram/bench depends on @engram/server (a workspace package, no cycle).

**Consequence.** `engram serve` itself is unchanged.
