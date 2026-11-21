---
date: 2026-11-21
author: claude-agent
type: decision
card: E1.5
chapter: design
pillar: twin
hypothesis: none
evidence:
  - specs/commit.qnt
  - docs/decisions/0010-retention-retires.md
supersedes: none
---

**What.** Property 3, "an offboarded scope accepts no later write", is checked over the open erasure window and over erased ids, not over every write after the report.

**Why.** The code accepts a write under a fresh id into a person scope after its offboarding's report, and ADR 0010's first open question leaves that to the lead. Stating the property more strongly would refute the model on behaviour the ADR records as intended for now.

**Result.** noWriteWhileErasing: no allowed write, adoption or withdrawal while an erasure of the scope is open, and none under an erased id, ever.

**Consequence.** If the lead answers the open question with a refusal, the property gains a clause and the model a check in `decide`.
