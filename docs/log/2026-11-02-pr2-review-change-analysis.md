---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/analysis/bootstrap.py
  - research/analysis/h1.py
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py"
supersedes: docs/log/2026-11-02-pr2-analysis-code.md
---

**What.** The analysis code after the review pass: pairing on kept seeds, stable bootstrap seeds, a TOST that holds its level, and harder planted data.

**Why.** Review findings P2-1, P2-4, P2-5, P2-9 and P2-10.

**Result.** `paired_item_differences` pairs on (item, seed) and drops a session excluded under either condition; contrasts report `seeds_dropped`; each bootstrap seed hashes (benchmark, model, contrast); `tost` holds each side to 0.025 with an exact binomial route (`binomial_cdf`, `clopper_pearson_upper`). `test_analysis.py` has 65 tests: planted data with an item effect, a planted null through the H1 table, both secondary-arm cases, another model's sessions, the TOST's level on the margin in ten cases, and published Clopper-Pearson bounds.

**Consequence.** None.
