---
date: 2026-11-28
author: claude-agent
type: decision
card: X16
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_gate_mutation_audit.py
  - fixtures/mutants/
supersedes: none
---

**What.** `test_every_frozen_mutant_still_applies_once_to_the_committed_code` in `make test` checks that each mutant's find string occurs exactly once in its file on the committed code, and that each configured invariant's test name is still in its file.

**Why.** The audit itself runs only in `make test-repro`, which CI does not run, so a core change that moves a mutated line would otherwise go unnoticed until someone reruns the row. The check costs well under a second.

**Result.** All 34 mutants apply on main's code at b207dbc4.

**Consequence.** A card that edits one of the mutated lines (cards E1.7, E2.15 and E2.16 edit `write.ts`, `adopt.ts` and `offboard.ts`) fails this test and must rewrite the mutant's `find` and `replace` against its code in the same PR, then rerun the row. If that coupling proves too costly, the check can move to the audit alone.
