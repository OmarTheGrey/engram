---
date: 2026-11-28
author: claude-agent
type: change
card: X17
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/scripts/results_page.py
  - research/configs/results-page.json
  - research/tests/test_results_page.py
  - docs/research/results.html
  - "make results-page CHECK=1"
supersedes: none
---

**What.** `make results-page` writes `docs/research/results.html`, one self-contained HTML page of every committed result, from the results register's config, the MANIFEST and the results files.

**Why.** Gate C's read-out needs a page an examiner can check claim by claim, and card X13's reproduction needs one artefact to compare.

**Result.** The page has, per hypothesis, its result with its figure inlined or a generated line saying it has none and what it still needs; the three proofs of concept (leakage, trace replay, mutation audit) in their own section with a bar each; the other checks, with the five rows of proposed arms marked exploratory; and all 27 MANIFEST rows with sha256, command and cost. Inline CSS and SVG, no script, light and dark. `research/tests/test_results_page.py`: 22 tests pass.

**Consequence.** A new MANIFEST row or changed result needs `make results-page` in its PR; `make test-repro` and the test fail otherwise.
