---
date: 2026-11-20
author: claude-agent
type: failure
card: RV8
chapter: evaluation
pillar: research
hypothesis: none
evidence:
  - research/tests/test_prereg.py
supersedes: none
---

**What.** The research suite failed once after the first MANIFEST rows: 1 failed, 231 passed (`uv run pytest` in `research/`), on `test_every_manifest_result_maps_to_exactly_one_hypothesis`.

**Why.** The new results were named `label-audit.json`, `label-audit-longmemeval.json` and `cost-table.json`, which match no hypothesis's Results glob (`research/results/h1-*` and so on).

**Result.** Renamed with an `h1-` or `h2-` prefix (the decision entry on result names); `tests/test_prereg.py` passes, 10 tests.

**Consequence.** Every later result of this card is named `h<N>-` from the start.
