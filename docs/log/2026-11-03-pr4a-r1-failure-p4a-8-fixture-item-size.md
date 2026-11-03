---
date: 2026-11-03
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H1
evidence:
  - research/results/h1-cost.json
  - packages/runner/src/research/cost-shapes.ts
supersedes: none
---

**What.** The cost table took tokens per memory item, and the judge's prompt, from the two fixture checkpoints unscaled, while it scaled the item count and the probe prompt to the full set.

**Why.** Item size and judge prompt depend on the episode, and the fixture has two. Found by the review (P4A-8), which measured the fixture episodes' turns at 88.9 characters against 114.2.

**Result.** Measured as the runner shows them, the fixture's reads hold longer items than the full set's lists: 164.6 characters per item under C2 and C3, 171.6 under C4, 211.7 under C5, against 138.8 to 141.2, 118.3 to 126.1 and 130.1 to 138.8 on the full set (`measured` in `research/results/h1-cost.json`); turns up to each as-of turn are 122.7 against 119.8. Tokens per item fall by 5.9 to 20.4, the judge's prompt by 17.

**Consequence.** Scale by what a session shows, not by a whole-episode mean.
