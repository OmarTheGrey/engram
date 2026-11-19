---
date: 2026-11-19
author: claude-agent
type: measurement
card: L2
chapter: results
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-fault-set.json
  - research/configs/h3-fault-set.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h3_fault_set.py --config research/configs/h3-fault-set.json --out research/results/h3-fault-set.json"
supersedes: none
---

**What.** H3's seeded-fault set over LongMemEval's cleaned S split at the pin, seed 20261119: counts per class, keyed and unkeyed apart, and the sha256 of each set file (MANIFEST sha256 `babaf446...`).

**Why.** H3 measures lint precision and recall on card L2's set; v1 can name it before the tag.

**Result.** 500 states, 261,250 events, 9,000 labels: 4,500 faults and 4,500 near-misses. Faults: stale 1,000 keyed and 500 unkeyed; contradictory 0 keyed and 500 unkeyed; misplaced 500 and 500; unsupported 1,000 and 500. Expected lints: each of five deterministic lints on 500 keyed faults; contradiction on 1,000 and unsupported-claim on 500 unkeyed; 500 wrong-scope faults expect none. Label check: 2,500 of 2,500 keyed faults flagged by their expected lint, 0 near-misses or unlabelled items by a measured lint; all 1,500 model-tier faults and 1,500 near-misses are units L3 would send.

**Consequence.** L4 lints `.engram/faults/h3-fault-set/` after checking these hashes.
