---
date: 2026-11-28
author: claude-agent
type: measurement
card: E9.16
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h1-crosswalk.json
  - research/configs/crosswalk.json
  - research/results/MANIFEST.md
  - docs/compliance/README.md
  - "uv run python research/scripts/crosswalk.py --config research/configs/crosswalk.json --out research/results/h1-crosswalk.json --table docs/compliance/README.md --legal .engram/upstream/legal"
supersedes: docs/log/2026-11-28-e9-16-measurement-crosswalk.md
---

**What.** The unregistered `research/results/h1-crosswalk.json` row moved again in card E9.16's PR after review: C52 now names the person level, the asserted identity, the report's accounting outside the bundle and a fourth test, and its limits say what stays out.

**Why.** Review findings 2 and 3.

**Result.** A support artefact, not a hypothesis result. The script printed "crosswalk: 53 claims, 50 evidenced by 118 tests in 37 files, 3 not evidenced, 34 obligations" and "34 quotes stand in the primary texts". New sha256 `cb41e492d3f5a19ea2aed87e39393df3301e1fd900fe66e516ae86061ab06c42`, MANIFEST commit 17c8a06e.

**Consequence.** The results register and page are regenerated from it.
