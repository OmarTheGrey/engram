---
date: 2026-11-25
author: claude-agent
type: change
card: ANS-2026-11-25
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/README.md
  - docs/architecture.md
  - docs/tasks/ANS-2026-11-25.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** The lead's answers of 2026-11-25 are recorded in `docs/tasks/lead-decisions.md`, and every document that listed the eight ADRs as proposed now says accepted.

**Why.** Card ANS-2026-11-25 carries the lead's "accept the adrs" into the record.

**Result.** `lead-decisions.md` gains the section "The lead's answers, 2026-11-25" (items 34, 35, 60 to 66) and a note naming the cards that resolve the other open items (RD1, L8, E9.9 with ADR 0049); section F marks each item answered. Updated: the ADR index, `docs/architecture.md`, `docs/design/tui.md`, cards E8.12, E8.15 and E9.4, `docs/tasks/backlog.md`'s two ADR 0034 rows, `docs/absorbed.md`, the AWM reading note and ADR 0012. No registered section of the pre-registration was touched; none listed these ADRs as proposed.

**Consequence.** No ADR awaits the lead now. `make lint-docs` and the tasks-and-decisions test check the record.
