---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H4
evidence:
  - research/results/h4-power.json
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-21-answers-decision-h4-model-family.md
---

**What.** H4's model family keeps 761 items per arm, with its own power cited from `research/results/h4-power.json` (one family, margin 0.05, alpha 0.01; review finding ANS-7).

**Why.** The earlier entry argued from four families' joint power; the file gives one family's power directly.

**Result.** 761 items give at least 80 percent power wherever C5's rate is at most 0.1, except at kappa 1 with identical seeds: 0.843 at a rate of 0.05, and 1,522 items needed at 0.1 (`targets`, families 1).

**Consequence.** That case is H4's stated limit; a larger size would need the lead before H1's data exist (item 9).
