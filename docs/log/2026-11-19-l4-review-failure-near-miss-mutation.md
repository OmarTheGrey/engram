---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: implementation
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
  - research/tests/test_h3_lints.py
supersedes: none
---

**What.** Review finding L4-2: replacing `elif lint in la["near_miss_of"][tier]` with `elif la["kind"] == "near-miss"` in `lint_scores` survived all 16 tests.

**Why.** No planted case had a near-miss flagged by a lint other than its own.

**Result.** A test now flags an expired-validity near-miss with the orphan lint: the orphan lint's false positives stay 1, the finding counts as `elsewhere.other_labels`, and expired-validity's false positives stay 0. The mutation fails it; dropping the lint filter in `hits` fails five tests.

**Consequence.** Both halves of the matching rule are now pinned by tests.
