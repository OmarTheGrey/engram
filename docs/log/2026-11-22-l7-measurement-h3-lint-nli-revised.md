---
date: 2026-11-22
author: claude-agent
type: measurement
card: L7
chapter: results
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-nli.json
  - research/configs/h3-lint-nli.json
  - "make h3-lint-nli"
supersedes: docs/log/2026-11-22-l7-measurement-h3-lint-nli.md
---

**What.** Regenerated research/results/h3-lint-nli.json with the score counts per cut, the forward-only flags at 0.9 and `decides: false`; its MANIFEST row names the regenerating commit.

**Why.** Review L7-2 and L7-8.

**Result.** Unchanged: per seed the tier drops 18 of the model tier's 113 contradiction calls, flags none and sends 95; all four contradiction faults land in the band. New: pairs at or above 0.5, 0.9, 0.99 and 0.999 are 92, 87, 79 and 61 by both directions and 85, 81, 70 and 56 forward only; forward-only flags at 0.9 cover 28 items, 4 of them contradiction faults and 6 with no label. Replays: 0 new calls, 0 new scores.

**Consequence.** Scripted model figures check the pipeline only. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
