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
  - docs/decisions/0031-c1-and-c4-on-each-benchmark.md
supersedes: none
---

**What.** C4 retrieves through the same `memory_read` tool over the store as C2 and C3; GateMem's RAG-Policy TF-IDF or embedding top-k retrieval is not ported.

**Why.** The runner keeps retrieval out of the differences between conditions (conditions.ts, ADR 0015 decision D13): the model chooses its query and the store answers it in every condition. Upstream's top 20 by embeddings would also need an embedding model, a paid call this plan forbids.

**Result.** The C3 and C4 reads of the same items differ only in the metadata attributes (`conditions.test.ts`).

**Consequence.** C4 is not upstream's RAG-Policy pipeline end to end; ADR 0031 and v1 say so.
