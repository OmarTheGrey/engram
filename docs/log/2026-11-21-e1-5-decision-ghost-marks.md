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
  - specs/README.md
supersedes: none
---

**What.** Property 3 is judged on ghost state: `gMarks`, the marks the offboardings themselves opened (a report removes its own and every mark begun before it), and `erasedIds`, recorded on each allowed change at its append.

**Why.** Review finding E1.5-4. Removing marks by sequence number is a second implementation of V-1's rule, independent of `openMarks`' map of marks open at each begin.

**Result.** The mark-closing mutant (a report closes every open mark, m7), which passed everything before, now fails noWriteWhileErasing at seed 1. The README says a later report closes an earlier mark by design, so writes are accepted while the earlier offboarding still deletes and sweeps.

**Consequence.** Whether that acceptance is wanted is for the lead; the property states it as accepted.
