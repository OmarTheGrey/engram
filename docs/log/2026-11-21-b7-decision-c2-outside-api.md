---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/seam.ts
  - packages/runner/src/conditions.ts
supersedes: none
---

**What.** C2 is served by the launcher under `/ungoverned/v1`, with /api/v1's write and read shapes, calling the adapter directly and core's `retrieve`.

**Why.** /api/v1 is the plane, and the runner's C2 is memory without it (ungoverned tools over the adapter); a C2 through /api/v1 would be C5.

**Result.** The seam test shows the difference: a model-sourced write to `team:support` is denied by C5 at medium and stored by C2.

**Consequence.** If wrong, C2 runs through another path; the shim is unchanged, only its base URL.
