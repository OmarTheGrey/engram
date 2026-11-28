---
date: 2026-11-28
author: claude-agent
type: change
card: X16
chapter: evaluation
pillar: plane
hypothesis: none
evidence:
  - packages/core/test/property/invariants.test.ts
  - packages/core/test/property/chain.test.ts
  - packages/core/test/unit/plane/offboard.test.ts
  - "make test-invariants"
supersedes: none
---

**What.** The review of X16 asked for the three test gaps the audit found to be closed in the invariants' own tests. Invariant 2 now runs one fixed case: an import restatement beside one user write, at k = 2, must be refused under `engram/promote/no-evidence`. Its trusted-kind guard also counts only active confirmers. The two-handle walk checks, at every offboarding's report, that the person scope holds no item (candidates included) but those a store failure kept back. The walk now writes one pool item as a candidate. The chain test recomputes every link as SHA-256(0x02, previous, leaf) with node:crypto.

**Why.** A survivor of `I2-untrusted-confirms`, `I1H-erase-active-only` or `I9-link-ignores-previous` showed that the invariant's test could not see that bug.

**Result.** Each of the three mutants is now killed by its invariant test. `make test-invariants`: 3 files, 21 tests passed, 55.7 s.

**Consequence.** The audit is rerun, and its measurement is superseded.
