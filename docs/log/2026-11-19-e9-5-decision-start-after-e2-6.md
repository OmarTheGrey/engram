---
date: 2026-11-19
author: claude-agent
type: decision
card: E9.5
chapter: evaluation
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
  - docs/tasks/E9.5.md
  - docs/log/2026-11-19-lead-decision-twin-dogfood.md
supersedes: none
---

**What.** The procedure says the two weeks start on the lead's go, after card E2.6 merges, rather than the day card E9.4 merged.

**Why.** The lead's decision named E9.4's merge as the start; the orchestrating session recommended waiting for E2.6, which closes the race between two processes on one log that the dogfood would otherwise run beside, and the start date is the lead's call.

**Result.** The card's status line and `docs/dogfood.md` say the kit is ready and the two weeks wait on the lead's go.

**Consequence.** The lead's go is a `milestone` entry naming the commit everyone starts from.
