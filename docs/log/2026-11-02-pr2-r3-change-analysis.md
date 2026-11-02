---
date: 2026-11-02
author: claude-agent
type: change
card: R1
chapter: implementation
pillar: research
hypothesis: H4
evidence:
  - research/analysis/equivalence.py
  - research/analysis/__init__.py
  - research/tests/test_equivalence.py
  - docs/conventions/testing.md
  - "uv run pytest research/tests/test_analysis.py research/tests/test_equivalence.py"
supersedes: docs/log/2026-11-02-pr2-r2-change-analysis.md
---

**What.** The analysis code after the third review round: `intersection_union_p`, H4's one p-value, and a docstring that states the TOST's level is checked over the composite null.

**Why.** Review findings R2-1 to R2-4 and the coordinator's request for H4's Holm input.

**Result.** `test_equivalence.py` (45 tests) adds the threshold Holm case, the intersection-union p, monotonicity on every lattice point, and the exact lattice levels against enumeration, trinomial sums and simulation, with the composite supremum against the identical-seed boundary and a random search. `test_analysis.py` is unchanged. The testing convention names both files.

**Consequence.** None.
