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
supersedes: none
---

**What.** The tier on the fault catalogue, checked against datasketch 2.0.0 as an oracle (MANIFEST row h3-near-duplicate.json, sha256 47823464).

**Why.** Card R2's measure (a) of the proposed arm P4: agreement of the MinHash estimate with an independent one, a check of the implementation, not a recall.

**Result.** Over 66 compared pairs, the tier and datasketch agree on the side of the threshold for 64 at 0.80 (0.970, Wilson 0.896 to 0.992), 63 at 0.85 (0.955, 0.875 to 0.984) and 58 at 0.90 (0.879, 0.779 to 0.937); mean absolute differences 0.024 tier to oracle, 0.016 tier to exact. On the tier's own fixtures precision and recall are 3 of 3. One unlabelled finding, on duplicate.near-miss.

**Consequence.** Exploratory: not part of H3's registered analysis until P4 is registered.
