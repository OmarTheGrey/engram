---
date: 2026-11-26
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: H1
evidence:
  - docs/tasks/lead-decisions.md
  - docs/tasks/X20.md
  - docs/tasks/R6.md
  - docs/research/preregistration.md
supersedes: docs/log/2026-11-26-gwfix-decision-x20-stops.md
---

**What.** The lead answered two pre-registration questions on 2026-11-26. A: should pre-tag condition 3's stopping set (401, 402, 403) be amended for card X20? "Amend: 404 + backstop": a 401, 402, 403 or 404 stops the run, except that a moderation-flagged 403 excludes its session; the run stops when five distinct items in a row each end in a refused answer call. B: should the Models rule take the maker's endpoint even without `seed`? "Seed first": the maker's endpoint only if it honours `seed`, otherwise the cheapest that does.

**Why.** Verification finding N3: both were changes to registered text made under the delegation, which goes to the lead. The backstop counts items, not sessions (finding N1).

**Result.** Recorded in `docs/tasks/lead-decisions.md`; X20 and R6 rewrite their sentences in their own pull requests.

**Consequence.** The orchestrator's X20 entry is superseded on the backstop's unit.
