---
date: 2026-11-27
author: claude-agent
type: decision
card: H5P
chapter: design
pillar: distill
hypothesis: H5
evidence:
  - docs/research/preregistration.md
  - docs/tasks/H5P.md
supersedes: none
---

**What.** Proposed for the lead: the Statistics section's exclusion reasons as registered, plus `tau2 no record` for a session tau2 writes no simulation record for; a task tau2 ends at `max_steps` or `max_errors` scored 0, never excluded; the turn limit's reason not applied.

**Why.** The first draft's list differed from the Statistics section and left "tau2 run fails" undefined, which could exclude lost tasks and bias success upward (review finding F5). tau2's configs bound a task by `max_steps`, not the runner's `turn_limit` (`packages/bench/src/tau2/config.ts`).

**Result.** Card H5P row 21.

**Consequence.** The lead's answer entry on this item supersedes this one; nothing is registered until then.
