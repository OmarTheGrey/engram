---
date: 2026-11-02
author: claude-agent
type: failure
card: X1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - packages/bench/test/gatemem/rag-policy.test.ts
  - packages/bench/scripts/check-rag-policy-upstream.ts
supersedes: none
---

**What.** A mutation check that let the RAG-Policy gate's billing role see every topic passed the fixture golden test; a second mutation, in the office projects rule, failed it on five checkpoints.

**Why.** The fixture's one billing asker reaches no patient through its query, so the gate refuses before the role's tags matter; 20 checkpoints in four episodes cannot exercise every role and relationship branch of upstream's tables.

**Result.** Only the development-time comparison on all 2,218 checkpoints covers every branch the released data takes; it gave 0 mismatches. It needs the pinned full set and is not part of `make test`.

**Consequence.** A change to `rag-policy.ts` should be rerun against the full set with `check-rag-policy-upstream.ts` before it merges.
