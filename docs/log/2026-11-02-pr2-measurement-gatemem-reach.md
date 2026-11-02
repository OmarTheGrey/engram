---
date: 2026-11-02
author: claude-agent
type: measurement
card: R1
chapter: results
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-gatemem-reach.json
  - research/configs/h1-gatemem-reach.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h1_gatemem_reach.py --config research/configs/h1-gatemem-reach.json --out research/results/h1-gatemem-reach.json"
supersedes: none
---

**What.** The GateMem reachable-leak share on the pinned full set (commit `a983828`, all eight data files matching the manifest): 727 access and 763 forgetting checkpoints through ADR 0030's mapping and the plane.

**Why.** Plan decision 11; the evidence for the forgetting decision in PR 4.

**Result.** Access: 260 checkpoints (35.8 percent) have at least one leak target in a turn the asker can read, 151 (20.8 percent) every target, and 457 (62.9 percent) a target located in the history but none readable. Forgetting: 565 (74.0 percent), 481 (63.0 percent) and 197 (25.8 percent). Forgetting by domain: medical 53.1, household 64.1, education 82.2, office 92.3 percent. No turn write was denied, and strict, medium and permissive give identical rows (`identical_across_presets`).

**Consequence.** Read with the finding entry of the same day.
