---
date: 2026-11-02
author: claude-agent
type: decision
card: X1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/decisions/0009-retrieval-explanations.md
  - packages/core/src/plane/read.ts
  - packages/runner/test/retrieval.test.ts
supersedes: none
---

**What.** The plane matches an item it reaches only through a grant when the item holds every query term, the lexical stores' rule, instead of any term; ADR 0009 is amended.

**Why.** H1 needs C5 to be C2 plus the plane's filter (review finding P3-1). The orchestrator's choice, finding granted items through the store's own search, is what ADR 0009 forbids (D5, N1: the store is never searched outside the reader's member scopes, so hidden items cannot crowd a granted one out of a capped hit list). The every-term rule is the closest thing that keeps N1.

**Result.** On every GateMem fixture checkpoint and six queries each, C5's entries are a subset of C2's on the fake store (`retrieval.test.ts`); reverting the rule fails 11 of its 21 tests. `make test-invariants` passes.

**Consequence.** On Mem0 (semantic, top 20) the subset can fail; H1 runs on the fake store.
