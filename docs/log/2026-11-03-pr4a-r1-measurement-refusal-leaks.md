---
date: 2026-11-03
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-refusal-leaks.json
  - research/configs/h1-refusal-leaks.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_refusal_leaks.py --config research/configs/h1-refusal-leaks.json --out research/results/h1-refusal-leaks.json"
supersedes: none
---

**What.** The GateMem checkpoints where one of the reach config's five plain refusals is itself scored as a leak, by id (MANIFEST sha256 `d7e9f3d0...`).

**Why.** H1's sensitivity table leaves them out of the primary set (orchestrator's item 9); PR 2's reach result counts them without naming them.

**Result.** 41 of 1,490 checkpoints: 29 of 727 access-control and 12 of 763 active-forgetting, equal to the reach result's counts. Each row lists which refusals the scorer counts as a leak there. `research/configs/h1-table.json` names the list (`sensitivity.items_from`); with access control as the primary set, its 29 access ids leave the sensitivity table.

**Consequence.** Part B reports the sensitivity table beside the primary in v1.
