---
date: 2026-11-22
author: claude-agent
type: decision
card: L7
chapter: design
pillar: research
hypothesis: H3
evidence:
  - research/scripts/h3_lint_nli.py
  - research/tests/test_h3_lint_nli.py
supersedes: none
---

**What.** The threshold rule keeps the upper strictly above every pass-labelled score; a pass scored 1 makes it refuse.

**Why.** Review L7-8: the rule capped the upper at 1, which is not above a pass scored 1, so such a pass would have been flagged.

**Result.** No upper of at most 1 lies strictly above a score of 1, so the script now raises an error naming the score and asking for thresholds chosen by hand. On the current fixtures the highest pass is 0.9961, so the thresholds and the result are unchanged by this. A pytest covers it.

**Consequence.** A full-set rule must say what it does then. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
