---
date: 2026-11-02
author: claude-agent
type: change
card: X1
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - packages/bench/src/gatemem/rag-policy.ts
  - packages/bench/scripts/upstream-rag-policy-golden.py
  - fixtures/bench/gatemem/upstream-rag-policy-golden.json
  - packages/bench/test/gatemem/rag-policy.test.ts
  - packages/bench/scripts/check-rag-policy-upstream.ts
supersedes: none
---

**What.** GateMem's RAG-Policy agent (`bench/agents/rag_policy.py` at `a983828`) is ported for C4: the metadata it attaches to each turn chunk and its relationship-aware gate's verdict for the asker.

**Why.** Plan decision 4 makes C4 on GateMem the benchmark's own RAG-Policy, ported with golden tests against upstream as card B1 ported the judge.

**Result.** `upstream-rag-policy-golden.py` runs upstream's agent (retrievers stubbed) and records, per checkpoint, the allowed turn ids and a hash of the chunk metadata; the port matches on all 20 fixture checkpoints (`rag-policy.test.ts`) and, by `check-rag-policy-upstream.ts` on the pinned full set, on all 2,218 with 0 mismatches.

**Consequence.** C4's verdicts are upstream's; a change to the port fails the golden test.
