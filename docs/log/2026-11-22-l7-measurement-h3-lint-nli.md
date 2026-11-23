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
supersedes: none
---

**What.** Reported the NLI tier beside the model tier on card L4's fixture (two LongMemEval questions, seeds 1 and 2); MANIFEST row research/results/h3-lint-nli.json.

**Why.** The card's delta report: model calls saved, precision and recall per fault class.

**Result.** Per seed the model tier sends 113 contradiction calls; the tier drops 18 and sends 95 (15.9 percent saved), flags none. All four contradiction faults land in the band, all four near-misses are dropped. Seed 2: the scripted model's two planted false flags on near-misses are dropped, so tiered precision on contradictory is 1.0 against the model tier's 0.333; recall 0.5 in both. Replays: 0 new calls, 0 new scores.

**Consequence.** Scripted model figures check the pipeline only. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
