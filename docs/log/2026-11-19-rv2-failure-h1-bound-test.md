---
date: 2026-11-19
author: claude-agent
type: failure
card: RV2
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/analysis/h1.py
  - research/tests/test_analysis.py
  - "uv run pytest research/tests (with adjusted = min(1.0, 4 * p) in decide_h1): 258 passed"
supersedes: none
---

**What.** H1's Gate C decision bound had a test that could not fail (RV-EXP-6): `decide_h1`'s interim bound with 4p in place of 5p passed every research test.

**Why.** The by-hand cases used p = 0.004, 0.02 and 0.2, and each gives the same read-out under 4p and 5p; no test asserted the adjusted value itself.

**Result.** Reproduced on `07828fc`: with the mutant, `uv run pytest research/tests` gave 258 passed. The bound decides H1 until H2 to H5 report, so a wrong factor would have moved a p between 0.01 and 0.0125 from "undecided" to "supported" unseen.

**Consequence.** The fix adds the separating case and asserts `adjusted` (`docs/log/2026-11-19-rv2-h1-bound-test.md`).
