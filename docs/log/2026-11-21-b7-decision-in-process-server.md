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
  - packages/bench/package.json
supersedes: none
---

**What.** The C5 server is `engram serve`'s app in process (@engram/server's `listen` over `workspaceOf`), not the `engram serve` command, on a fixed clock, 2026-01-02T00:00:00Z.

**Why.** The command opens only the files and Letta stores and reads the wall clock; recency then moves with the run's time and changes the prompt, so a replay would miss.

**Result.** @engram/server and @engram/adapters become dependencies of @engram/bench (workspace links). Events of one C5 cell are byte-identical across two runs (events.jsonl sha256 61871900...).

**Consequence.** None.
