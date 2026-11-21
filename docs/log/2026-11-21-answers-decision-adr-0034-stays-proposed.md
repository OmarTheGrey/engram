---
date: 2026-11-21
author: claude-agent
type: decision
card: none
chapter: design
pillar: twin
hypothesis: none
evidence:
  - docs/decisions/0034-grant-change-is-the-owners-governed-write.md
  - scripts/test/tasks-and-decisions.test.ts
supersedes: none
---

**What.** ADR 0034 keeps its status, proposed, though item 34 answers "accept it, with a one-year cap and the first-write rule".

**Why.** The acceptance carries two rules that are not built, with fixtures to fix in the same card, and the brief keeps ADR 0034 proposed; `OWNER_DECIDES` in `scripts/test/tasks-and-decisions.test.ts` still lists it.

**Result.** The amendment of 2026-11-21 records items 34 to 36 and rows RV4 and RV7, and says the ADR is accepted when the card building the cap and the first-write rule merges. RV7's amendment of this ADR is marked accepted (item 39).

**Consequence.** That card flips the status, adds a decision entry, and removes 0034 from `OWNER_DECIDES`.
