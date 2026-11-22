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
supersedes: docs/log/2026-11-21-l5-near-duplicate-result-near-pairs.md
---

**What.** The near-duplicate result regenerates to sha256 f50c8f46 (MANIFEST commit a3d403ea): the near-pair floor is read from the config, and the result reports `capped`, the items the candidate cap cut.

**Why.** Review findings L5-R1 (rule 9: the floor of 0.7 was a constant in the script) and L5-R3 (arm P4 will report the capped count on LongMemEval).

**Result.** No figure moved. All 66 pairs: agreement with datasketch 64 at 0.80, 63 at 0.85 (0.955), 58 at 0.90. The 21 pairs at or above 0.7: 19, 18 (0.857, Wilson 0.654 to 0.950) and 13. Precision and recall on the tier's fixtures 3 of 3. `capped`: 0 items on the catalogue.

**Consequence.** Exploratory until arm P4 is registered.
