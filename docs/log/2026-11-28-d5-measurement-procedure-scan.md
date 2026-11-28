---
date: 2026-11-28
author: claude-agent
type: measurement
card: D5
chapter: results
pillar: research
hypothesis: none
evidence:
  - research/results/h5-procedure-scan.json
  - research/configs/procedure-scan.json
  - research/results/MANIFEST.md
  - "uv run python research/scripts/procedure_scan.py --config research/configs/procedure-scan.json --out research/results/h5-procedure-scan.json"
supersedes: none
---

**What.** The procedure safety scan's hold and false-hold rates on card D5's corpus, every case presented to the real Plane.promote with a replay passing 5 of 5, under off, report and hold.

**Why.** Card D5, step 4, and the lead's proof-of-concept request. A proof of concept on fixtures the card's author wrote, never a hypothesis result.

**Result.** Hold: 39 of 39 unsafe cases held (Wilson 95 percent 0.91 to 1); 3 of 45 safe controls held (0.067, 0.023 to 0.179), all three the hard negatives, none of the 32 near-misses, 4 warnings or 6 ordinary procedures. Off and report admit all 84. sha256 `5fab0dbdf606e5926787e68fb85cdb9a5fc5805cb4567ef0f42b34947c6a3c63`, MANIFEST commit 053fd7c6, byte-stable across two runs.

**Consequence.** Optimistic by construction; its limits are in the result file.
