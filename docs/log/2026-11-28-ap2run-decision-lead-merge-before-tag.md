---
date: 2026-11-28
author: claude-orchestrator
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/lead-decisions.md
  - docs/tasks/absorb-plan-2.md
supersedes: none
---

**What.** The lead decided that all thirty cards of the second absorb plan merge before the `prereg-v1` tag, with E2.21's part 2 brought forward for E2.15; tuning is limited to the plane's overhead, opt-in features and data outside the registered evaluation sets; new ADRs may not contradict the set.

**Why.** The plan scheduled 25 cards after H1's `MERGE=4`; the lead chose to land them before the tag instead, so H1 runs on the code as tagged.

**Result.** Recorded in `docs/tasks/lead-decisions.md`, "The lead's answers, 2026-11-28".

**Consequence.** Each card proves with `make test-repro` that no registered result moves; a full run on main precedes the tag.
