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

**What.** Invariant 5's grant walk now writes items carrying grants (to the grantee, a covering pattern or another principal, of any class, expiring at a step of the walk), rewrites held items to another class by the owner or a co-holder, and requires grantee reads refused for a grant's class and for its expiry. It strengthens the lead-owned file.

**Why.** Verification finding V-5, and V-4's class changes. A refusal is counted only for an active item in its window that the read matched and the oracle does not let the grantee read.

**Result.** The grant walk saw 174 allowed changes, 21 reads a changed grant admitted, 3 refused after a removal, 29 refused for class, 10 for expiry and 9 class changes of items carrying grants; mutants ignoring a grant's class at read, or class changes in the gate, each fail it.

**Consequence.** ADR 0034 lists it.
