---
date: 2026-11-27
author: claude-agent
type: finding
card: RD1
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/results/MANIFEST.md
  - packages/tag/src/tag.ts
  - packages/runner/src/research/gatemem-reach.ts
  - packages/runner/src/research/longmemeval-clock.ts
  - docs/log/2026-11-25-rd1-milestone-paused.md
supersedes: none
---

**What.** RD1 moves no registered byte by construction, and `make test-repro` proved 23 of the 24 MANIFEST rows of 2026-11-25 byte-identical; `research/results/h2-frontier-axes.json` is not yet proven by a run.

**Why.** Narrowing removes grants, lineage ids, `grants_used` places and grant clauses from answers only. Admission, order, scores, the read event's reason and `item_ids` are unchanged, and no prompt carries grants or lineage: the memory tag holds id, scope, content, rank, score and rule. Cassette keys hash prompts, so none moves.

**Result.** By reading the code, `frontier_axes.py` cannot move: it uses `read.items` ids and scopes only (`gatemem-reach.ts`, `longmemeval-clock.ts`). Its rerun was cut on 2026-11-25 and is left to the orchestrator, who runs test-repro serially. The two label-audit rows main changed since (card R5) were not rerun on this branch; they read no read answer.

**Consequence.** Before merge: the frontier-axes rerun, compared with its MANIFEST sha256.
