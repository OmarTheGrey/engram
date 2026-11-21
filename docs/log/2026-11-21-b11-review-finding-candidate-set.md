---
date: 2026-11-21
author: claude-agent
type: finding
card: B11
chapter: limitations
pillar: research
hypothesis: H5
evidence:
  - packages/bench/src/tau2/plane.ts
  - packages/bench/test/tau2/plane.test.ts
  - packages/core/src/plane/read.ts
supersedes: docs/log/2026-11-21-b11-finding-serve-retrieval.md
---

**What.** Through `engram serve`, C5's read was not only ranked differently from C2's: its candidates differed. The plane's default read searches the store, and the files store's search needs every query term, while core's `retrieve`, which C2 uses, takes any term. The earlier finding said only the ranking differed, and that was wrong.

**Why.** Review B11-1. The pre-registration's "Shared retrieval for C2 to C5" says no condition uses a store's own search.

**Result.** C5 now reads through a plane built with `retrieval: { pipeline: "core", limit }`, as the runner's coreReadPlane does. The plane test reads "reservation change", where each item holds only "reservation": C5 returns C2's three items in C2's order. With the core read removed, the test fails.

**Consequence.** No change to `engram serve` is needed before card X11; the launcher hosts C5's plane.
