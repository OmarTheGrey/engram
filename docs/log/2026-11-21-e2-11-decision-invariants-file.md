---
date: 2026-11-21
author: claude-agent
type: decision
card: E2.11
chapter: design
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/src/oracle.ts
  - docs/conventions/testing.md
  - "make test-invariants"
supersedes: none
---

**What.** The lead-owned invariants file gains invariant 8 and the oracle three readings (`floorProblem`, `protectionProblem`, `attestedKind`), an `eligible` argument to `budgetVictims`, and a floor-aware `effectiveKind`; this change needs a second reviewer before it merges.

**Why.** ADR 0040, decision 7, asks for the eighth invariant; `docs/conventions/testing.md` allows changes to the file only with a second reviewer and a decision entry.

**Result.** Invariant 8 runs its own generator, so the seeds and cases of invariants 1 to 7 and of the stateful model do not move; the old arguments of `budgetVictims` and `effectiveKind` keep their meaning. `make test-invariants`: 2 files, 18 tests passed.

**Consequence.** The orchestrator's independent review is the second reviewer. Whether invariant 8 belongs to Part I of the thesis is the lead's call after Gate C.
