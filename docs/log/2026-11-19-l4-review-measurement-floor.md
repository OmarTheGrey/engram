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
supersedes: docs/log/2026-11-19-l4-measurement-floor.md
---

**What.** The deterministic floor on card L2's full set after the review fix pass: 500 states, 9,000 labels (MANIFEST sha256 `354da571...`).

**Why.** H3's deterministic tier per class; the fix pass changed the matching and the wording, not the numbers.

**Result.** By construction: keyed 2,500 of 2,500 found, 0 of 2,500 near-misses flagged, and 500 of 500 with no false positive for each keyed lint; unkeyed 0 of 2,000. Pooled recall per class depends on the generator's keyed to unkeyed mix: stale 1,000 of 1,500, unsupported 1,000 of 1,500, misplaced 500 of 1,000, contradictory 0 of 500. Measured: 967 duplicate findings on base items, whose precision is bounded only by 0 and 1 until the audit is judged.

**Consequence.** The model-based delta is measured against these numbers.
