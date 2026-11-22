---
date: 2026-11-22
author: claude-agent
type: decision
card: D3
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - research/configs/d3-validate-fixture.json
  - fixtures/distill/d3-validate/write_script.py
  - fixtures/distill/d3-validate/tasks.json
supersedes: docs/log/2026-11-21-d3-decision-d2-candidates.md
---

**What.** The fixture replays five of D2's thirteen candidates: AWM's three, plus the rule candidates `raise-the-fetch-timeout-from-5-to-10-seconds` (induced from `bump-timeout-06`, which is in the pool) and `rename-parserow-to-parserecord-everywhere` (split of six, five drawn).

**Why.** D2's fix pass replaced its one rule control with ten, one per session. All ten at 15 sessions each would add 150 sessions.

**Result.** Five candidates is 93 sessions and 334 cassettes. They show an admit, refusals below and at the baseline, the no-worse rule deciding, and two drift cases, rule candidates replaying their own session's files (1 and 0 of 5). `bump-timeout-16` has its own repository.

**Consequence.** If D2's rule candidates change again, the config's names and the script follow.
