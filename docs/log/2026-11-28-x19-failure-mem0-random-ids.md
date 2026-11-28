---
date: 2026-11-28
author: claude-agent
type: failure
card: X19
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/residue/stores.ts
  - research/results/h3-erasure-residue.json
supersedes: none
---

**What.** The first result was not byte-stable: a second full run differed in one cell, SQLite and Mem0's write-ahead log (99 residue canaries, then 100), and so in its outcomes hash.

**Why.** Mem0 names every memory and entity with node:crypto's randomUUID (directly and through the uuid package). Those ids reach the log as store refs, so the log's B-tree pages, and which stale bytes its WAL keeps, changed from run to run. Every other cell, the Postgres and Mem0 run included, matched.

**Result.** `seedRandomUuid` replaces randomUUID in the check's process with UUIDs drawn from the config's seed, before Mem0 loads (rule 6); a Mem0 write now returns the same ref on two runs, and two SQLite and Mem0 runs give identical outcomes.

**Consequence.** The row was regenerated and checked twice; the measurement entry was rewritten.
