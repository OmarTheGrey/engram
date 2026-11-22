---
date: 2026-11-21
author: claude-agent
type: decision
card: L6
chapter: design
pillar: plane
hypothesis: none
evidence:
  - docs/tasks/L6.md
  - packages/core/src/supersede.ts
supersedes: none
---

**What.** A close is proposed only for a candidate that starts before the new item, overlaps it and ends no later (Allen `overlaps` or `finishedBy`). Every other overlap Graphiti acts on is flagged for review.

**Why.** Graphiti ends the new edge when a candidate starts later, and closes a candidate that outlasts a bounded new fact. Under the card, nothing is retired automatically and a person judges contradictions.

**Result.** Seven review reasons in lint/supersession.ts, each with a unit test in test/unit/lint/supersession.test.ts.

**Consequence.** If wrong, more cases go to review than a person needs to see; nothing is closed wrongly.
