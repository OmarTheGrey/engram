---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.4
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** Invariant 5 now requires a returned item's grants to equal those of the latest allowed event for it in the oracle's replay, and every allowed event that changes what the item's grants admit (its grants, or its class while it carries grants) to be its owner's write or grant change. This changes the lead-owned file and only strengthens it.

**Why.** Verification finding V-7; the second clause replaces the any-write check it asked to drop, and covers V-4's class changes.

**Result.** Invariant 5 passes; the resurrection mutant fails it.

**Consequence.** ADR 0034 lists it.
