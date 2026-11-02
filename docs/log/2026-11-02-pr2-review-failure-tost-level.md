---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - research/analysis/bootstrap.py
  - research/tests/test_analysis.py
  - "uv run pytest research/tests/test_analysis.py -k level"
supersedes: none
---

**What.** Review finding P2-1: H4's first TOST did not hold its level at the sizes the power table reported.

**Why.** With one pair's true difference on the margin, the review measured equivalence declared 18.4 percent of the time at 14 items (0 against 0.10, 10 points), 13.4 and 8.5 percent at 24 and 48 (0.02 against 0.07, 5 points), and 34.6 percent with identical seeds at 10 items: a pair with no discordant item always passed, and with few discordant items the bootstrap's tail was far too short. My power runs measured power only, never the level.

**Result.** The TOST was replaced (decision entry `2026-11-02-pr2-review-decision-tost-method.md`), tests now plant the difference on the margin, and every reported size carries its measured level.

**Consequence.** Every size in the first `h4-power.json` is withdrawn; the superseding measurement entry gives the new ones.
