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

**What.** Invariant 1's two-handle walk now stops some offboardings after their mark and runs them again, requires that no mark stays open, and checks that every grant an owner's grant change removed is back at the end only through a deliberate event; nothing was weakened.

**Why.** The verification asked that the walk fail on V-1, V-2 and V-3.

**Result.** 300 runs pass with guards requiring stopped offboardings and checked removals; closing only the named mark fails the walk.

**Consequence.** The lead's second review covers the change.
