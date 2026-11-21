---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/lead-decisions.md
  - docs/decisions/0017-cached-metered-seeded-model-calls.md
supersedes: docs/log/2026-11-21-answers-decision-lead-spend-cap.md
---

**What.** Item 59 in `docs/tasks/lead-decisions.md` now holds the lead's words only, with what the coordinator added on a separate "added under the delegation" line (verification finding V-2).

**Why.** The earlier entry and row mixed the lead's answer with the ledger unit, the runner card and the hand check, which he did not say.

**Result.** The lead's answer: the per-run ceilings stay at 1.25 times each run's high estimate; a programme-wide cap equals the API credit held; a run that would cross it pauses, and he decides whether to resume. Added under the delegation: ledger-dollar ceilings, the billed-dollar cap and its conversion, the runner card before 1 December, the operator's credit check. ADR 0017's amendment separates the two the same way.

**Consequence.** The lead can overturn the additions without touching his answer.
