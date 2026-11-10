---
date: 2026-11-06
author: claude-agent
type: decision
card: L1
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** One line of the lead-owned invariants file changed: invariant 1's check that no Plane method but read hands out an unreadable item now calls `plane.lint(outsider, at, "person:s")` and asserts it leaks nothing, instead of expecting NotImplementedYet.

**Why.** The file asks for each unimplemented method to be classified when it lands. The testing convention requires a second reviewer and a decision entry for any change to this file.

**Result.** `make test-invariants` passes with the change. Nothing else in the file changed.

**Consequence.** Flagged for second review: the lead or a second reviewer approves this line before merge.
