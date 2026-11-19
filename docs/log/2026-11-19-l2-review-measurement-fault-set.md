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
supersedes: docs/log/2026-11-19-l2-measurement-fault-set.md
---

**What.** H3's seeded-fault set after the review fix pass, over LongMemEval's cleaned S split at the pin, seed 20261119 (MANIFEST sha256 `a274701d...`).

**Why.** The fix pass hardened the near-misses, counts natural findings and adds an audit sample and `limits`.

**Result.** 500 states, 261,250 events, 9,000 labels: 4,500 faults and 4,500 near-misses. Faults keyed and unkeyed: stale 1,000 and 500, contradictory 0 and 500, misplaced 500 and 500, unsupported 1,000 and 500. By tier: 1,500 model, 2,500 deterministic only, 500 neither. Label check: 2,500 of 2,500 keyed faults flagged, 0 near-misses, 0 unexpected findings on injected items; 967 duplicate findings on base items, 50 drawn for audit; all 1,500 model faults and 1,500 near-misses planned by L3; under medium 45 of 1,000 unsupported-claim units would not be.

**Consequence.** L4 lints this set and reads its audit sheet.
