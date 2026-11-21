---
date: 2026-11-20
author: claude-agent
type: decision
card: RV8
chapter: evaluation
pillar: research
hypothesis: H2
evidence:
  - research/tests/test_prereg.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** RV8's results are named for one hypothesis each: `h1-label-audit.json`, `h2-label-audit-longmemeval.json`, `h2-cost-table.json` and `h2-frontier-axes.json`; their configs keep their names.

**Why.** `test_every_manifest_result_maps_to_exactly_one_hypothesis` failed on the first names (`label-audit.json`, `cost-table.json`): each result must match exactly one hypothesis's Results glob. The cost table covers H1 to H5, and LongMemEval's audit serves H2 and H3, so one owner had to be chosen.

**Result.** The cost table goes to H2, whose metric is cost and whose stopping rule names the spend ceiling; LongMemEval's audit to H2, the first hypothesis to run on it; the frontier to H2's knee. The test passes.

**Consequence.** If the lead would file the cost table elsewhere, it is a rename of one file and its MANIFEST row.
