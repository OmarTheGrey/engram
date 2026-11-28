---
date: 2026-11-28
author: claude-agent
type: failure
card: E2.19
chapter: implementation
pillar: govern
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** `make test-invariants` failed after the three Plane methods were added: invariant 1's surface check requires every Plane method to be classified ("a new Plane method must be classified here").

**Why.** The card says its invariant stays out of the lead-owned invariants file, so the file was not in its plan; the surface check exists so a new method is checked for leaks.

**Result.** The three methods were classified with leak checks by the outsider (see the lead-owned files decision), and the run passed: 23 tests.

**Consequence.** A second reviewer for that edit.
