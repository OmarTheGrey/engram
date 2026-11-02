---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-finding-h4-power.md
  - docs/log/2026-11-02-pr2-measurement-h4-power.md
supersedes: none
---

**What.** Review finding P2-7: the H4 entries carried wrong numbers, and the ladder could pick a rung on Monte Carlo noise.

**Why.** The 10-point minimum was 14 as written and 24 once degenerate passes failed, not 10; the 17 and 7 of 24 cells powered by about 100 items counted degenerate passes (14 and 6 without); the multi-pair factor ran 1.24 to 1.93, not 1.2 to 1.7, because I computed it only over cells whose estimate exceeded 100. One cell chose 3,620 items where the closed form gives 3,004 and the rung below scored 0.7975 over 400 studies.

**Result.** The rung the walk lands on and the rung below are now rerun with 1,000 studies each before one is kept; the joint closed form is reported beside every size.

**Consequence.** The H4 measurement and finding are superseded; the PR text is corrected.
