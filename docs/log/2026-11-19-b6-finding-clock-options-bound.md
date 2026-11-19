---
date: 2026-11-19
author: claude-agent
type: finding
card: B6
chapter: limitations
pillar: research
hypothesis: H2
evidence:
  - research/results/h2-longmemeval-ttl.json
  - docs/tasks/B6.md
supersedes: docs/log/2026-11-19-b6-finding-clock-options.md
---

**What.** The clock options for the lead, restated with the right bound on the ttl's effect and with what the sensitivity set leaves out (`docs/tasks/B6.md`).

**Why.** Review P6-1 and P6-2 of PR #51: the ttl changes C5's candidates in 54 questions, not only in the 38 that lose an evidence turn.

**Result.** At most 54 of 500 questions can differ, so medium's ttl can move C2 minus C5 by up to 10.8 points in either direction; 7.6 points is the scenario where every lost evidence turn costs its answer. The 446-question set leaves out 35 of 72 knowledge-update questions, 18 of 127 temporal-reasoning and 1 knowledge-update abstention, so it is a different estimand. Option 5 stands, as a sensitivity analysis that does not decide H2.

**Consequence.** The exact line for the pre-registration is in B6.md; backlog row "H2 clock choice".
