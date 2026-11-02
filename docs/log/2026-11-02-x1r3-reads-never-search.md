---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - packages/runner/src/conditions.ts
  - packages/runner/test/retrieval.test.ts
supersedes: docs/log/2026-11-02-x1-empty-query-lists-all.md
---

**What.** No condition's `memory_read` asks a store's own search, with or without query terms: C2 to C4 list every scope the store holds and run core's retrieval pipeline over the items; C5's plane runs it over its projection. A query with no terms returns the read limit's worth of items by confidence and recency.

**Why.** The superseded entry kept each store's search for queries with terms and said C2 to C4 measure it. Round 2 of PR #25's review (R1) replaced that with one pipeline for every condition, so that the conditions differ by mechanism, not by retrieval (`x1r2-core-retrieval-pipeline`).

**Result.** C2's list equals the pipeline over what the store lists on fake, files, Mem0 and Letta (`retrieval.test.ts`).

**Consequence.** A store's own retrieval is no part of H1 (review round 3, V-7).
