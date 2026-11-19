---
date: 2026-11-19
author: claude-agent
type: failure
card: L4
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/scripts/lint_scores.py
  - research/tests/test_h3_lints.py
supersedes: none
---

**What.** Review finding L4-1 (critical) on PR #49: class and subtype cells gave a label credit from any lint of the tier, not only the lints it names.

**Why.** `hits` and `unverified` called `flagged_by` with no lint filter. Per seed on the full set the reviewer counted 329 of 500 wrong-scope faults, 423 of 500 unsupported-claim faults (through contradiction), and all 500 missing-provenance, orphan and source-changed near-misses (through unsupported-claim) whose finding_on a model lint they do not name flags. The test `test_both_tiers_...` locked the defect in, crediting an orphan fault with a contradiction finding.

**Result.** Fixed (entry `2026-11-19-l4-review-decision-matching`); the floor's numbers do not move, as no deterministic finding lands on another lint's label.

**Consequence.** The live delta can no longer report wrong-scope recall above 0.
