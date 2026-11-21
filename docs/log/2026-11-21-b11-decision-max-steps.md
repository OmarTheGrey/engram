---
date: 2026-11-21
author: claude-agent
type: decision
card: B11
chapter: design
pillar: research
hypothesis: H5
evidence:
  - research/configs/b11-tau2-fixture.json
  - packages/bench/src/tau2/config.ts
supersedes: none
---

**What.** The fixture config sets `max_steps` 30 and `max_errors` 10. tau2's defaults at the pin are 200 and 10 (`DEFAULT_MAX_STEPS`, `DEFAULT_MAX_ERRORS` in src/tau2/config.py).

**Why.** Review B11-10. On the slice the longest trajectory is 12 messages, so 30 never binds. It only stops a script error from running for 200 steps. A live run is a different matter: tau2 ends a task at max_steps with reward 0, so a lower cap than tau2's changes the reward.

**Result.** The config states both numbers, and the launcher passes them to tau2's TextRunConfig.

**Consequence.** Card X11's configs use tau2's 200 unless the lead decides otherwise, since a lower cap would make its numbers incomparable with tau2's own.
