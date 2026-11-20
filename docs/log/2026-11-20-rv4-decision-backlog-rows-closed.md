---
date: 2026-11-20
author: claude-agent
type: decision
card: RV4
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/tasks/backlog.md
  - docs/tasks/RV4.md
supersedes: none
---

**What.** Four backlog rows leave the backlog, marked done on branch rv4: "Re-adoption of plane writes", "Adoption raises trust", "Adoption carries grants from a dropped file (RV-ADP-4)" and "Adoption after a folder move".

**Why.** The backlog's rule is that taking an item off it is a `decision` entry. Card RV4 fixes all four in core's adoption.

**Result.** Each row names what was done and the ADR amendment that records it; the evidence column keeps its earlier entries and adds this one.

**Consequence.** The twin dogfood's precondition "the adoption fix has merged" is removed from `docs/dogfood.md` and from card E9.5's status line; three preconditions remain, for the lead.
