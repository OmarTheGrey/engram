---
date: 2026-11-20
author: claude-agent
type: failure
card: X4
chapter: implementation
pillar: research
hypothesis: H1
evidence:
  - research/scripts/h1_figure.py
  - research/tests/test_h1_figure.py
supersedes: none
---

**What.** Review finding X4-4 on PR #57: the figure printed the relative reduction beside the registered numbers with nothing to tell them apart.

**Why.** The table marks it `"registered": false`, but the figure's label did not carry that.

**Result.** The label reads "relative reduction (not registered)", and the figure test asserts the whole label with its numbers.

**Consequence.** If the lead registers it, the label changes with the amendment.
