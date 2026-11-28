---
date: 2026-11-28
author: claude-agent
type: failure
card: X17
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_results_page.py
  - research/scripts/results_page.py
supersedes: none
---

**What.** A mutant of `results_page.py` that listed proofs of concept inside their hypothesis's section as well survived the first test suite.

**Why.** Every committed proof of concept serves no hypothesis, so the committed page could not show the leak, and no planted test had a proof of concept serving one.

**Result.** Four mutants were run by hand: the exploratory marking disabled, the manifest table's status cell swapped, the proofs-apart rule dropped, and the sha256 check disabled. Three were killed at once; the proofs-apart mutant survived. The new test `test_a_proof_of_concept_serving_a_hypothesis_stays_out_of_its_section` kills it (1 failed, 20 passed with the mutant; 21 passed without).

**Consequence.** Keeping proofs of concept apart from hypothesis results, the card's own requirement, is now pinned on planted data, not only on today's rows.
