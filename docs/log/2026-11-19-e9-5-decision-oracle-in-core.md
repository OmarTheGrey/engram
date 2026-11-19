---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/oracle.ts
  - docs/conventions/testing.md
supersedes: none
---

**What.** The invariants' oracle moved from `packages/core/test/property/oracle.ts` to `packages/core/src/oracle.ts`, unchanged, and the old path now re-exports it.

**Why.** The violation report must judge a member's log with the plane's own oracle, not a second reading of the policy, and production code should not import from a test folder. A re-export keeps every importer (the invariants file and five other tests) unchanged.

**Result.** `make test-invariants` and the oracle's own tests pass after the move with no other edit to the lead-owned file. The oracle is not exported from core's index, so no surface can make a decision with it (AGENTS.md rule 1). `docs/conventions/testing.md` records the new home.

**Consequence.** The lead-owned oracle now has a second user; a change to it changes what the report counts. A second reviewer is needed, as for any change to the invariants file.
