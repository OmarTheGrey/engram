---
date: 2026-11-22
author: claude-agent
type: finding
card: L7
chapter: discussion
pillar: research
hypothesis: H3
evidence:
  - research/results/h3-lint-nli.json
supersedes: none
---

**What.** On the fixture every contradiction fault scored above 0.993, yet the frozen upper threshold of 1 flags none of them.

**Why.** The lead decides whether P3's design should change before registration.

**Result.** Card L3's near-miss pair scored 0.9961 backward, so the rule put the upper at 1. A forward-only score (0.5157 on that pair) would have allowed an upper of 0.9, under which the fixture's four faults would be flagged with no model call. This was seen after the rule was fixed and was not acted on.

**Consequence.** Before registering P3, the lead may choose the direction rule or the fixture the thresholds come from; either is a design change, not a tuning. Arm P3 is proposed, not registered: this is an engineering check, not a thesis result.
