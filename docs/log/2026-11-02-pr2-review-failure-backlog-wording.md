---
date: 2026-11-02
author: claude-agent
type: failure
card: R1
chapter: implementation
pillar: research
hypothesis: none
evidence:
  - docs/tasks/backlog.md
supersedes: none
---

**What.** Review finding P2-12: the backlog's reachable-leak row said "done on branch prereg-pr2-research", which goes stale once the branch merges.

**Why.** A backlog row should name what exists after the merge, not where it was built.

**Result.** The row now says the share is measured by the pre-registration v1 plan's PR 2 and names `research/results/h1-gatemem-reach.json`.

**Consequence.** None.
