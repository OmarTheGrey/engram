---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/shard.ts
  - packages/runner/scripts/run.ts
  - packages/runner/test/rv6.test.ts
supersedes: none
---

**What.** A shard count above the item count was refused only after the shard's folder and `run.json` were made, so a later `MERGE` reported an unfinished shard instead of the real cause (review P60-7).

**Why.** The slice was taken inside the runner, after `make run` opened the journal.

**Result.** `openRunJournal` takes the config's items and checks the slice first; `make run` passes them (`configItemIds`). Tested: shard 1 of 4 over 3 items is refused and no folder exists; through the CLI, `SHARD=1/2` on a one-item config prints the refusal and creates nothing.

**Consequence.** `MERGE` now reports a missing shard, whose `SHARD=` run names the cause.
