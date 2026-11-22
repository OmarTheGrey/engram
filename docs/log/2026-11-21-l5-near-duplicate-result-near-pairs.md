---
date: 2026-11-21
author: claude-agent
type: measurement
card: L5
chapter: results
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-near-duplicate.json
  - research/configs/near-duplicate.json
  - research/scripts/near_duplicate.py
  - research/results/MANIFEST.md
  - "uv run python research/scripts/near_duplicate.py --config research/configs/near-duplicate.json --out research/results/h3-near-duplicate.json"
supersedes: docs/log/2026-11-21-l5-near-duplicate-result.md
---

**What.** Supersedes the result entry of this date: the result now also reports agreement on the pairs near a threshold, checks the installed datasketch against the config's 2.0.0, and regenerates to sha256 76bd5a0b (MANIFEST commit ddbeb5e1).

**Why.** Review finding L5-8: most pairs are far from every threshold, where any two estimators agree.

**Result.** Over all 66 pairs, agreement with datasketch is unchanged: 64 at 0.80, 63 at 0.85 (0.955), 58 at 0.90. On the 21 pairs whose estimate or exact similarity is at least 0.7: 19 of 21 at 0.80 (0.905, Wilson 0.711 to 0.973), 18 at 0.85 (0.857, 0.654 to 0.950), 13 at 0.90 (0.619, 0.409 to 0.792). Precision and recall on the tier's fixtures: 3 of 3.

**Consequence.** Exploratory until arm P4 is registered; `near_pairs` is the figure to read.
