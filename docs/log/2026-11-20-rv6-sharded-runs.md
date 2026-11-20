---
date: 2026-11-20
author: claude-agent
type: change
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/shard.ts
  - packages/runner/src/journal.ts
  - packages/runner/test/rv6.test.ts
  - "make run CONFIG=research/configs/b3-gatemem-plane.json SHARD=1/3"
supersedes: none
---

**What.** `make run ... SHARD=i/n` runs the i-th of n contiguous blocks of a config's items into `<out>-shard-<i>-of-<n>`, and `MERGE=n` joins the n shard folders into `<out>` (design review RV-DES-10).

**Why.** The runner is serial, and H1 is large.

**Result.** Shards share the config's cassettes; no cache key names the shard. The merge concatenates results.jsonl, events.jsonl and usage.jsonl in shard order into a sealed journal; a runner pass with no session run checks every session is there once, in order, and rewrites the summary. `rv6.test.ts`: a faux run in one shard and the same run in three shards merged give byte-identical files and cassettes, a crashed shard resumes and merges, and a missing, unfinished, mixed or overlapping shard is refused. The CLI gave identical files on x1-h1-gatemem, x1-h1-mem-inv, b6-longmemeval-fixture and b3-gatemem-plane.

**Consequence.** H1 can run on n processes; the merged folder is where `make h1-table` reads.
