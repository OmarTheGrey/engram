---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-03-pr4a-finding-h4-power.md
  - research/results/h4-holm-levels.json
supersedes: none
---

**What.** Part A's H4 finding quoted sizes from the alpha 0.05 column beside those from 0.01, for example 100 items at 10 points, while only the alpha 0.01 sizes are checked at Holm's lower thresholds.

**Why.** H4's one p-value can meet Holm at 0.0125 or 0.01, and `research/results/h4-holm-levels.json` checks the alpha 0.01 sizes there; nothing checks an alpha 0.05 size below 0.05. The finding kept PR 2's framing without saying which column H4 may use. Found by the review (P4A-11).

**Result.** Superseded by `pr4a-r1-finding-h4-power`, which says H4's sample must come from the alpha 0.01 column.

**Consequence.** Part B takes H4's margin and sample from the alpha 0.01 column.
