---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: limitations
pillar: research
hypothesis: H4
evidence:
  - docs/log/2026-11-02-pr2-review-decision-exact-route-threshold.md
  - research/results/h4-power.json
supersedes: none
---

**What.** Review finding V4: the exact-route threshold entry said a probe "saw no size above 0.05", while the round-one result itself showed measured levels of 0.055 to 0.066 at reported sizes.

**Why.** The scratch probe ran 1,000 runs per case and printed only cases above 0.05 without checking against the committed result; I reported the probe as if it covered the result's sizes.

**Result.** The exact route and its threshold are withdrawn (decision entry `2026-11-02-pr2-r2-decision-no-exact-route.md`); claims about levels now cite the result's own exact and measured columns.

**Consequence.** None.
