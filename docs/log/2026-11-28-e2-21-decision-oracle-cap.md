---
date: 2026-11-28
author: claude-agent
type: decision
card: E2.21
chapter: implementation
pillar: plane
hypothesis: none
evidence:
  - packages/core/src/oracle.ts
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/unit/oracle-grants.test.ts
  - make test-invariants
supersedes: none
---

**What.** The lead-owned oracle and invariants file learn the cap: `expiryCapProblem` in `oracle.ts`, an optional `landing` argument to `writeForbidden`, and invariant 2 draws first writes only the cap or the first-write rule forbids.

**Why.** The card's step 6: the oracle judges the option as core does. Written apart from the evaluator: the distance is counted in whole seconds, then the fraction compared, rather than adding the cap.

**Result.** Invariant 2's new draw (`capOnly`, weight 1) needs more than 20 such writes per run. `make test-invariants`: 3 files, 21 passed. Under invariant 2, the cap-ignored and first-write-rule-dropped mutants are killed; the inclusive-boundary mutant survives (its draws sit years from the limit) and the unit tests kill it. Nothing was weakened; every other draw and guard is as before. Needs the lead's second review, as the convention asks.

**Consequence.** No frozen mutant names the new lines; the audit row is rerun.
