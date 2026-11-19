---
date: 2026-11-19
author: claude-agent
type: decision
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - make test-invariants
supersedes: none
---

**What.** Invariant 1's two-handle walk now crashes promotions and offboardings at their erasure and handover, adds a short walk of a stale write adopted and built on, checks every erased token whatever id carries it, and requires that withdrawals and narrowings never undo a later owner decision; nothing was weakened.

**Why.** The verification asked that the walk kill the narrowing-off and always-withdraw mutants on its own.

**Result.** 300 runs pass, with guards requiring checked removals and judged recoveries.

**Consequence.** The lead's second review covers the change.
