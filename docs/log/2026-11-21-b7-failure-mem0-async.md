---
date: 2026-11-21
author: claude-agent
type: failure
card: B7
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/merit/seam.ts
supersedes: none
---

**What.** The first recording run failed in its first C2 cell: `adapter.write is not a function`.

**Why.** createMem0Adapter returns a promise, and the seam used it unawaited.

**Result.** Awaited; the C1 cell before it had run. tsc would have caught it: tsc then found one more error, a store list typed string in config.ts, fixed with a type.

**Consequence.** tsc before any run.
