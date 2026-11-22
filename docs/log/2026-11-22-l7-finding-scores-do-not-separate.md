---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: limitations
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-nli.json
supersedes: none
---

**What.** On card L4's fixture the pinned NLI model's contradiction scores do not separate contradictions from unrelated pairs.

**Why.** The tier's flag band is only worth having if a high score means a contradiction.

**Result.** Pairs the contradiction lint pairs by shared terms, such as a chess club against a dry cleaner, score as high as the injected contradictions: 79 of 113 pairs score 0.99 or more and 61 score 0.999 or more by both directions (`score_counts`). Every contradiction fault scored above 0.993, so none was dropped, but most high scores are not contradictions.

**Consequence.** On this fixture the tier is a drop filter, never a judge. A flag band would need another model, a premise and hypothesis framing, or a different threshold source. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
