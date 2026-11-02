---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/tests/test_equivalence.py
  - research/analysis/equivalence.py
supersedes: none
---

**What.** Review finding R2-4: round two tested the TOST's monotonicity on one family of samples and two property tests, which a floor switched by dispersion can pass.

**Why.** A sample-based test sees only the (sum d, sum d^2) pairs its draws reach; the verifier's two mutants, a floor kept only below a dispersion (absolute or relative) and dropped above it, were not shown to fail them.

**Result.** A new test walks every (3 sum d, 9 sum d^2) with n sum d^2 at least (sum d)^2, at 20, 57, 114, 200 and 381 items, three margins and two alphas: at a fixed sum passing never resumes with more squares, at fixed squares never further from zero. Both verifier mutants fail it, and so does a floor made stricter when samples are sparse.

**Consequence.** None.
