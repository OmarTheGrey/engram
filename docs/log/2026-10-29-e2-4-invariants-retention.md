---
date: 2026-10-29
author: claude-agent
type: decision
card: E2.4
chapter: design
pillar: plane
hypothesis: H1
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/oracle.ts
  - packages/core/test/unit/oracle.test.ts
  - packages/core/test/generators.ts
  - docs/decisions/0025-retention-semantics.md
  - "make test-invariants"
supersedes: none
---

**What.** The lead-owned invariants gain a fifth property, and the oracles follow ADR 0025: invariant 1's excludes an item past its ttl, invariant 2's forbids a model, compaction or tool write restating content retired in its scope, and `budgetVictims` says what a budget check must evict.

**Why.** Plan section 4, PR 4, item 6: lifecycle is an admissibility axis, and "no scope over budget after any write sequence" is a property, not an example.

**Result.** Invariant 5 runs write, read and sweep sequences under budgeted policies and checks each write's evictions against the oracle; guards require both orders, utility choosing by reads, a manual ask, a swept expiry, a ttl ending exactly at the read, and a write forbidden by retired content alone. `make test-invariants`: 5 passed.

**Consequence.** Second reviewer: the orchestrator's verification of this branch, then the lead.
