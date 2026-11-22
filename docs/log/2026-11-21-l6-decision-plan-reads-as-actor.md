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

**What.** `planSupersession` uses only items the actor can read at the read's access time (`readableAt`). An unreadable item is `unknown_id`, and an unreadable ancestor is never a candidate.

**Why.** A plan must not name what the actor could not read.

**Result.** test/unit/plane/supersede.test.ts covers both cases; the server and MCP tests cover the unreadable case too.

**Consequence.** A chain broken by an unreadable link ends early for that actor.
