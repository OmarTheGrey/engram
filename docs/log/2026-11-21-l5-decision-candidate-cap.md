---
date: 2026-11-21
author: claude-agent
type: decision
card: L5
chapter: design
pillar: research
hypothesis: H3
evidence:
  - packages/core/src/lint/near-duplicate.ts
  - packages/core/test/unit/lint/near-duplicate.test.ts
supersedes: none
---

**What.** Each item reads at most the 64 earliest earlier members of each LSH bucket it is in, and estimates at most its 64 earliest earlier candidates (`CANDIDATE_CAP`); `stats.capped` counts the items cut.

**Why.** Review finding L5-4 asked for a cap on the bucket or on the candidates per item. Capping per item bounds both the reads (32 bands times 64) and the estimates, where skipping a large bucket, as codebase-memory-mcp does at 200, drops every pair in it.

**Result.** Linear with a bound of 64 estimates per item. Cost if wrong: a near-duplicate that only shares crowded buckets past their first 64 members is missed. The catalogue and the guard are unchanged.

**Consequence.** ADR 0018's note, the card and the code comment now say near-linear on varied text and capped on templated text.
