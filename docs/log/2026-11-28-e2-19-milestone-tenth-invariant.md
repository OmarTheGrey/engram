---
date: 2026-11-28
author: claude-agent
type: milestone
card: E2.19
chapter: evaluation
pillar: govern
hypothesis: none
evidence:
  - packages/core/test/property/approvals.test.ts
  - Makefile
  - "make test-invariants"
supersedes: none
---

**What.** The tenth invariant, in its own property file run by `make test-invariants`: no candidate becomes active without an allow by a routed approver before its request expires, and every expiry is one event, never early, with none due after a final sweep and no read returning a candidate.

**Why.** Card E2.19, step 4.

**Result.** 500 random route sets and step sequences per property. `make test-invariants`: 4 files, 23 tests passed. Mutants, each killed: the route check disabled (the oracle refuses a landing), the closed-version check disabled (a landing after expiry), the sweep skipping version 1 (a due request left unrecorded).

**Consequence.** Guards require routed and owner landings, route and self refusals, refusals and swept expiries in every run.
