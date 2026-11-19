---
date: 2026-11-19
author: claude-agent
type: failure
card: E9.5
chapter: limitations
pillar: twin
hypothesis: none
evidence:
  - docs/dogfood.md
supersedes: none
---

**What.** Review finding E95-13 (minor): the procedure did not say what a zero cannot show.

**Why.** An event records its actor's id, not its source, so the owner's agent posting a grant change through the route reads as the owner, and a first write naming another owner reads as that owner's consent.

**Result.** "What to send the team" states both; a test plants the first and records that the report gives 0.

**Consequence.** Recording an actor's capacity is the backlog row "An event's actor capacity".
