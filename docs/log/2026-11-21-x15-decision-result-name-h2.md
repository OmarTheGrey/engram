---
date: 2026-11-21
author: claude-agent
type: decision
card: X15
chapter: evaluation
pillar: plane
hypothesis: H2
evidence:
  - research/tests/test_prereg.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** Card X15's result is `research/results/h2-perf-budget.json`, its samples `research/results/h2-perf-budget-samples.jsonl`; the card named them `perf-budget.json`. The config and script keep the card's names.

**Why.** `test_every_manifest_result_maps_to_exactly_one_hypothesis` requires every MANIFEST file to match one hypothesis's Results glob, and `perf-budget.json` matches none. H2 is the governance tax ("enforcement costs utility and tokens"), and latency is that tax in time, so H2 owns it, as RV8 filed its cost table (`docs/log/2026-11-20-rv8-decision-result-names.md`). The registered sections of the pre-registration are not edited.

**Result.** The test passes with the new row. The result is descriptive: H2's registered metric, test and analysis do not change.

**Consequence.** If the lead files it elsewhere, it is a rename of two files and one MANIFEST row.
