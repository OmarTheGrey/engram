---
date: 2026-11-21
author: claude-agent
type: change
card: B7
chapter: implementation
pillar: research
hypothesis: H2
evidence:
  - packages/bench/scripts/merit-shim.py
  - packages/bench/src/merit/seam.ts
  - packages/bench/test/merit/seam.test.ts
supersedes: none
---

**What.** The memory seam: a Python shim registers MERIT's MemoryBase in `merit.memory.CONDITIONS` and calls `/api/v1/items` and `/api/v1/read` of `engram serve`'s app run in process (C5), or the same shapes under `/ungoverned/v1` (C2).

**Why.** The card maps MERIT's memory calls to Plane.write and Plane.read over loopback HTTP, as the runner defines each condition.

**Result.** C5 is the runner's coreReadPlane, C2 its ungovernedRead, both cut at 20. The actor is `person:merit-agent` with source model; the plane's write reason reads `provenance set by the plane: source model`. Seam tests pass (4 tests); routing C5 to the ungoverned backend fails 2 of them.

**Consequence.** C5 cells log every decision; `make bench` writes them to `events.jsonl`.
