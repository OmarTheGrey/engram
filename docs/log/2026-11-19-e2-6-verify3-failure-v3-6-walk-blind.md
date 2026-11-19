---
date: 2026-11-19
author: claude-agent
type: failure
card: E2.6
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
supersedes: none
---

**What.** Finding V3-6: the two-handle walk crashed offboardings only at their sweep, could not see erased content under a new id, and needed unit tests to kill the narrowing-off and always-withdraw mutants.

**Why.** Its erased-token check skipped tokens surviving items held, and nothing judged recovery against the owner's later decisions.

**Result.** The walk now crashes promotions and offboardings at their erasure and handover, keeps every erased token in view, and alone kills both mutants.

**Consequence.** None.
