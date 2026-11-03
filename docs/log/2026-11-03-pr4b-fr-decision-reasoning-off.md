---
date: 2026-11-03
author: claude-agent
type: decision
card: R1
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/research/prereg-v1-decisions.md
  - research/results/h1-cost.json
supersedes: docs/log/2026-11-03-pr4b-decision-reasoning-off.md
---

**What.** Recommended, for the lead's decision: every model runs with reasoning off, and only models pi-ai can run that way are candidates (decision sheet item 1), now weighed against instruction following.

**Why.** the final verification of PR #27 (V-9) asked the sheet to apply its own objection to a small M1: a model without reasoning may follow C3's policy and C4's verdicts less well, which makes C4 minus C5 easier to win.

**Result.** That cost is real and is stated; against it, reasoning at a provider's unstated default cannot be pinned, sits outside the cache key, and would mix into H4's model family. A stated reasoning effort for every model is the alternative, which the runner does not offer and six candidates could not take.

**Consequence.** If the lead prefers reasoning on, the runner needs an effort setting before the tag.
