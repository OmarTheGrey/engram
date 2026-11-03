---
date: 2026-11-03
author: claude-agent
type: change
card: R1
chapter: evaluation
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/prereg-v1-plan.md
  - "ENGRAM_OFFLINE=1 make run CONFIG=research/configs/h1-gatemem.json MODEL=openrouter/openai/gpt-5.6-terra LIVE=1"
  - "make h1-table"
supersedes: none
---

**What.** Section 7 of `docs/tasks/prereg-v1-plan.md` is the readiness record.

**Why.** Plan section 4, PR 4, item 5: what is ready, each remaining human step, and the commands that run H1 once a key exists.

**Result.** It lists what is ready; seven human steps (the lead's answers; a PR applying them, with code for items 9 and 10; the two-phase label audit; tag and deposit; one OpenRouter key; the members' readings of UNREAD replies before the table; the MPBench request); M2 and M3 configs as a later step for H4; six commands, checked offline: both COUNT runs, LIVE refused under `ENGRAM_OFFLINE=1`, REPLAY refused with nothing recorded, `make h1-table` stopping at the converter, three scripts' `--help`. Not run: any live call, the converter on live output, doctor with a key, the readings, the audit.

**Consequence.** Making the table a rule-9 result is left to the PR that runs H1 (`2026-11-03-pr4b-finding-h1-pipeline-gaps`).
