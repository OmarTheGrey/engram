---
date: 2026-11-21
author: claude-agent
type: decision
card: B7
chapter: design
pillar: research
hypothesis: H2
evidence:
  - packages/bench/src/merit/launch.ts
  - packages/bench/PINS.md
supersedes: none
---

**What.** Each arc gets its own fresh store, log and server, the k-th MERIT memory on the k-th backend.

**Why.** MERIT builds a fresh memory per arc (`cond_cls()`), and the runner's C2 reads every scope a store holds, so a shared store would show arc 2 the memories of arc 1.

**Result.** Two backends per C2 and C5 cell; each C5 arc log has 22 writes and 5 reads.

**Consequence.** A config with corruption sweeps would need one backend per memory instance, which the launcher counts as arcs times world seeds.
