---
date: 2026-11-21
author: claude-agent
type: finding
card: R2
chapter: design
pillar: research
hypothesis: H1
evidence:
  - https://github.com/OWASP/www-project-agent-memory-guard/blob/b052787cc342/src/agent_memory_guard/bench/scenarios.py
  - docs/tasks/X14.md
  - docs/tasks/absorb-plan.md
supersedes: none
---

**What.** OWASP's AMSB corpus has 21 scenarios, not the 23 that the absorb plan and card X14 state.

**Why.** Card R2's proposal P1 sizes the red-team arm on this corpus, so the count had to be read at the source.

**Result.** At commit `b052787cc342`, `scenarios.py` holds 15 attacks and 6 benign controls. The attacks are prompt injection 4, sensitive data 3, protected key 3, memory persistence 4 and size anomaly 1, each graded low to critical with weights 1 to 4. The repository was pushed to on 2026-11-21, so it is still changing.

**Consequence.** Card X14 should count the scenarios at the commit it pins and correct "23" in its steps. P1 uses 21 and says so.
