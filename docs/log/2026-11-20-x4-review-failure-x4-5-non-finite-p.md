---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/analysis/holm.py
  - research/tests/test_holm.py
supersedes: none
---

**What.** Review finding X4-5 on PR #57: no test fed NaN or an infinity to `holm` or `interim_bound`, so a range check written as `p < 0 or p > 1`, which lets NaN through, would have passed.

**Why.** The code already refused NaN, through `not 0 <= p <= 1`, but no test held it there.

**Result.** Parametrised NaN, inf and -inf cases for both. The mutant `p < 0 or p > 1` fails one test in `holm` and one in `interim_bound`.

**Consequence.** Nothing in the code changed for this finding.
