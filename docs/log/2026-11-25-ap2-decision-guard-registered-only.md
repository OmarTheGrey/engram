---
date: 2026-11-25
author: claude-agent
type: decision
card: none
chapter: design
pillar: research
hypothesis: none
evidence:
  - docs/tasks/absorb-plan-2.md
  - research/results/MANIFEST.md
supersedes: none
---

**What.** The plan's guard binds registered results only; the unregistered rows `h1-crosswalk.json` and `h1-secret-guard.json` may move, each in a named card's PR with a measurement entry.

**Why.** Review finding AP2-1: cards E0.7, D4, E9.16 and E2.16 must regenerate those rows, which the old universal guard forbade. The coordinator's decision follows the addendum.

**Result.** Section 5's intro names both rows and when each may move: the crosswalk after the tag, the secret guard after H1's `MERGE=4`. Selection test 1 now says a default may change only when no registered byte moves, proved by rerun (AP2-7).

**Consequence.** Cost if wrong: a reviewer must check each moved row against its card.
