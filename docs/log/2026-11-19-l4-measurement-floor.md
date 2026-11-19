---
date: 2026-11-19
author: claude-agent
type: measurement
card: L4
chapter: results
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-floor.json
  - research/configs/h3-lint-floor.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/h3_lint_floor.py --config research/configs/h3-lint-floor.json --out research/results/h3-lint-floor.json"
supersedes: none
---

**What.** The deterministic floor on card L2's full set: 500 states, 9,000 labels (MANIFEST sha256 `389628e5...`).

**Why.** H3's deterministic tier, per class, keyed and unkeyed apart.

**Result.** Keyed: recall 2,500 of 2,500 (Wilson 0.998 to 1.0), 0 of 2,500 near-misses flagged, by construction. Unkeyed: 0 of 2,000 found. Per class pooled recall: stale 1,000 of 1,500, unsupported 1,000 of 1,500, misplaced 500 of 1,000, contradictory 0 of 500. Each of the five keyed lints: 500 of 500, no false positive. 967 duplicate findings on base items are unverified; with them, precision lies between 0.721 and 1.0. The run agrees with L2's label check, which the script enforces.

**Consequence.** The model-based delta is measured against these numbers.
