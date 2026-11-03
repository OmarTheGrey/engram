---
date: 2026-11-03
author: claude-agent
type: finding
card: R1
chapter: discussion
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - research/results/h4-holm-levels.json
  - research/analysis/equivalence.py
supersedes: docs/log/2026-11-03-pr4a-finding-h4-power.md
---

**What.** H4's sample must come from the alpha 0.01 column of `research/results/h4-power.json`: those sizes hold the TOST's level at every Holm threshold, and no other size is checked below 0.05.

**Why.** H4's one p-value may meet Holm at 0.05 / k for k up to 5; the alpha 0.05 sizes are checked at 0.05 only (review P4A-11).

**Result.** At alpha 0.01, one family needs 320 to 640 items per arm at 10 points, 761 to 2,560 at 5 and 2,560 to 17,222 at 2; four families 320 to 905, 761 to 3,620, 2,560 to 20,480. Each holds at all five thresholds (the largest level a search of the boundary |mean| = margin found, iid items assumed). About 100 items per arm reaches no alpha 0.01 size.

**Consequence.** For part B: 10 points with 320 to 905 items per arm, or 5 points with 761 to 3,620.
