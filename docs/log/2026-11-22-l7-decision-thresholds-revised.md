---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/configs/h3-lint-nli.json
  - research/scripts/h3_lint_nli.py
supersedes: docs/log/2026-11-22-l7-decision-thresholds.md
---

**What.** Restated the threshold decision: upper 1 and lower 0.1, from card L3's two contradiction fixtures.

**Why.** Review L7-3: the first entry overstated how much of it the data decided.

**Result.** The commit order does not show the rule came before the evaluation scores: the fixture's scores were recorded in the commit that froze the thresholds. Both bounds, `upper_at_least` 0.9 and `lower_at_most` 0.1, were hand choices; the lowest flag-labelled score was 0.9996, so the lower of 0.1 is the hand cap, not derived from data. Only the upper of 1 came from the data, the highest pass at 0.9961.

**Consequence.** The lead's rule for the full set: the rule and its thresholds are committed before any full-set score is recorded. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
