---
date: 2026-11-28
author: claude-agent
type: decision
card: E9.12
chapter: design
pillar: twin
hypothesis: none
evidence:
  - packages/core/src/policy/evaluate.ts
  - packages/core/src/dogfood.ts
supersedes: none
---

**What.** The consent check runs after membership, version, move, grant and downgrade checks and before the write rule; its rule id is the fixed `engram/write/consent`, listed in the dogfood report's `ENGRAM_RULES`.

**Why.** After membership, only a member of the scope learns an opt-out exists (finding N3's rule). Before the rule, review and the guards, a covered write never lands as a candidate. A fixed id names no scope or person, which the dogfood report requires (rule 12).

**Result.** The property test checks a covered write is denied by consent or by one of those earlier checks, never allowed; the dogfood test that checks ENGRAM_RULES against the source passes.

**Consequence.** No line a frozen mutant names changed: `test_every_frozen_mutant_still_applies_once_to_the_committed_code` passes.
