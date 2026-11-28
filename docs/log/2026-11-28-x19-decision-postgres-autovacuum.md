---
date: 2026-11-28
author: claude-agent
type: decision
card: X19
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - packages/bench/src/residue/backend.ts
supersedes: none
---

**What.** The check's embedded Postgres runs with `autovacuum=off`, and its files are read after a `CHECKPOINT`.

**Why.** Autovacuum fires on a timer, so whether a page was pruned when the files are read would differ from run to run, and a result must be byte-stable. Without the checkpoint the heap files need not yet hold what the WAL holds.

**Result.** The Postgres rows reproduce; the limits say a vacuum marks space reusable without zeroing it, which this run does not measure.

**Consequence.** None. Cost if wrong: the Postgres heap count is an upper bound on what a vacuumed server keeps.
