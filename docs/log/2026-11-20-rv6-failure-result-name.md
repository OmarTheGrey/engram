---
date: 2026-11-20
author: claude-agent
type: failure
card: RV6
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/tests/test_prereg.py
  - research/results/MANIFEST.md
supersedes: none
---

**What.** `make test` failed once: `test_every_manifest_result_maps_to_exactly_one_hypothesis` refused `research/results/check-runs-cost.json`, which maps to no hypothesis.

**Why.** Each hypothesis in the pre-registration owns its results by a file-name glob (`research/results/h1-*` and so on), and the first name of the checks' price had no prefix.

**Result.** The result, its config, script and test were renamed to `h1-check-runs-cost` and `h1_check_runs_cost`, the result regenerated (sha256 `fd5a2507...`, changed only by its `name` field) and its MANIFEST row rewritten; the test passes.

**Consequence.** The price of the pre-tag checks is filed under H1, whose live run they precede.
