---
date: 2026-10-29
author: claude-agent
type: failure
card: A2
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/adapters/test/letta/race.test.ts
supersedes: none
---

**What.** The race test written for review finding R2-1 accepted any number of items deleted by user commits as git's stale-index race.

**Why.** It recorded every deleted item as "reverted" without checking that the deleting commit raced the Engram commit that added it, so a defect that un-stages each item after its commit passed it 3 of 3 runs (the verifier's mutation, N2).

**Result.** At most one reverted item per run is allowed, and the deleting user commit's parent must be the `engram: write <id>` commit of that item; the mutation now fails the test every run.

**Consequence.** A tolerance in a test is bounded by the evidence for it.
