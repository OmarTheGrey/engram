---
date: 2026-11-21
author: claude-agent
type: finding
card: E1.5
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - specs/commit.qnt
  - specs/README.md
supersedes: none
---

**What.** Six mutants of the model, each removing one guard, run against each of the four properties (5,000 traces of 60 steps, seed 1) and the scenario tests.

**Why.** To see which guards the properties actually protect.

**Result.** Caught: the erased-id refusal at the decision removed (erasureHolds, noWriteWhileErasing, writeAfterEraseTest); the import ceiling removed (adoptionNeverRaisesTrust, ownBytesAdoptedTest); the offboarding clause of the stale check removed (three properties, two tests); settle ignoring an open erasure (erasureHolds, noWriteWhileErasing). Caught by a test only: the withdrawal removed (withdrawalTest); it guards grants, which the model does not carry. Caught by nothing: adoption's deferral of a listing older than the log, which guards against a lost update, not erasure or trust.

**Consequence.** The four properties do not cover freshness; a fifth (no lost update) would be needed to check the deferral.
